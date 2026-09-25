import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useAuth } from "../context/AuthContext";
import { chatDB } from "../db/sqlite";
import { colors } from "../public/assets/colors";
import { globalStyles } from "../public/styles";
import { styles } from "../public/styles/profileStyles";
import { IUserAllData } from "../types/dashboard.types";
import { UserCategoryEnum } from "../types/user.types";
import { syncUserData } from "../utils/syncUserData";
import {
    OnboardingDataPatch,
    UpdateUserDataPayload,
    updateUserData,
} from "../api/updateuserData";
import { getFlowDefinition, IFlowDefinitionNode } from "../api/flowDefinition.api";
import { NODE_ID_TO_ONBOARDING_FIELD } from "../constants/onboardingFieldMap";
import {
    DELIVERY_DATE_NODE_ID,
    FLOW_SLUGS,
    STILL_BIRTH_TERMINATION,
} from "../constants/chat";
import { FlowType } from "../types/chat.types";
import OnboardingAnswerInput from "../components/profile/OnboardingAnswerInput";
import StillBirthSupportModal from "../components/profile/StillBirthSupportModal";
import { AnalyticsEvent, recordError, track } from "../analytics";

type AnswerValue = string | string[] | null;

/**
 * Only meaningful once the baby has arrived, so they follow the delivery date:
 * locked while it is still in the future, required once it is not.
 */
const POST_DELIVERY_FIELDS = ["delivery_outcome", "delivery_type"] as const;

const hasAnswer = (value: AnswerValue): boolean =>
    Array.isArray(value) ? value.length > 0 : !!value;

const EditProfile = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { userId, userToken } = useAuth();

    const [userData, setUserData] = useState<IUserAllData>();
    const [nodes, setNodes] = useState<IFlowDefinitionNode[]>([]);
    const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showStillBirthSupport, setShowStillBirthSupport] = useState(false);

    const user = userData?.user;

    // Contact fields are shown read-only, and only when a value exists.
    const hasEmail = !!user?.email;
    const hasPhone = !!user?.mobile_number;

    // Delivery date is editable only for currently-pregnant users (NP) or while
    // the stored delivery date is still in the future; locked for postpartum.
    const deliveryEditable = useMemo(() => {
        if (!user) return false;
        if (user.user_category === UserCategoryEnum.NP) return true;
        const dd = user.onboarding_data.delivery_date;
        return dd ? new Date(dd as any).getTime() > Date.now() : false;
    }, [user]);

    /**
     * The feeding question is postpartum-only, matching the onboarding flow, which
     * skips it for NP and NN (chat-flow.service.ts, isPregnancyRelatedNode and
     * isFutureDeliveryRalatedNode). Without this gate the form would offer a question
     * she was never asked and has no baby to answer it about.
     */
    const isPostpartum = user?.user_category === UserCategoryEnum.PP;

    /**
     * Tracks the date being edited rather than the stored one, so the dependent
     * fields react the moment she picks a new date — before anything is saved.
     */
    const deliveryDateIsFuture = useMemo(() => {
        const selected = answers.delivery_date ?? user?.onboarding_data.delivery_date;
        if (!selected) return false;
        const time = new Date(selected as any).getTime();
        return !isNaN(time) && time > Date.now();
    }, [answers.delivery_date, user]);

    /**
     * Once the delivery date has passed, both answers are mandatory — the rest of
     * the app branches on them (postpartum week, still-birth support, check-ins),
     * so saving a past date without them would leave the profile inconsistent.
     */
    const missingPostDeliveryAnswers = useMemo(() => {
        if (deliveryDateIsFuture) return [];
        return POST_DELIVERY_FIELDS.filter(field => !hasAnswer(answers[field] ?? null));
    }, [deliveryDateIsFuture, answers]);

    const saveBlocked = missingPostDeliveryAnswers.length > 0;

    useEffect(() => {
        (async () => {
            try {
                // User data: SQLite first, fall back to an API sync.
                let local = await chatDB.getUserData(userId as string);
                if (!local && userToken) {
                    await syncUserData(userToken);
                    local = await chatDB.getUserData(userId as string);
                }
                if (local) {
                    setUserData(local.data);
                }

                // Question + option catalog (localized) from the flow definition.
                const flow = await getFlowDefinition(FLOW_SLUGS[FlowType.ONBOARDING]);
                setNodes(flow.nodes || []);
            } catch (err) {
                console.error("[EDIT PROFILE] load failed:", err);
                setLoadError(true);
            } finally {
                setLoading(false);
            }
        })();
    }, [userId, userToken]);

    // Seed the editable answers from the stored onboarding_data once both the
    // user and the flow nodes are available.
    useEffect(() => {
        if (!user || nodes.length === 0) return;
        const onboarding = user.onboarding_data;
        const seeded: Record<string, AnswerValue> = {};
        for (const node of nodes) {
            const field = NODE_ID_TO_ONBOARDING_FIELD[node.id];
            if (!field) continue;
            const current = onboarding[field] as unknown;
            seeded[field] = (current ?? null) as AnswerValue;
        }
        setAnswers(seeded);
    }, [user, nodes]);

    const updateAnswer = (field: string, value: string | string[]) => {
        setAnswers(prev => ({ ...prev, [field]: value }));
    };

    /**
     * Close before navigating: EditProfile stays mounted underneath the pushed
     * screen, so a modal left visible would sit on top of wherever she lands.
     */
    const leaveTo = (navigate: () => void) => {
        setShowStillBirthSupport(false);
        navigate();
    };

    const handleSave = async () => {
        if (!userId || !userToken || !user) return;

        // The button is disabled in this state; this is the backstop.
        if (saveBlocked) {
            Toast.show({
                type: "error",
                text1: t("common.error"),
                text2: t("editProfile.deliveryDetailsRequired"),
                position: "bottom",
            });
            return;
        }

        const onboardingPatch: OnboardingDataPatch = {};
        for (const node of nodes) {
            const field = NODE_ID_TO_ONBOARDING_FIELD[node.id];
            if (!field) continue;
            // Skip the delivery date entirely when locked so the backend doesn't
            // reject the whole update for a postpartum user.
            if (field === "delivery_date" && !deliveryEditable) continue;
            // Never send a field the form did not render — an NP/NN save would
            // otherwise null out a value she was never shown.
            if (field === "feeding_method" && !isPostpartum) continue;
            (onboardingPatch as Record<string, AnswerValue>)[field] = answers[field] ?? null;
        }

        const payload: UpdateUserDataPayload = { onboarding_data: onboardingPatch };

        // Captured before the write: the support prompt is for the moment she tells
        // us she lost her baby, not for every subsequent save of an unrelated field.
        const hadStillBirth =
            user.onboarding_data.delivery_outcome === STILL_BIRTH_TERMINATION;
        const nowStillBirth =
            (onboardingPatch as Record<string, AnswerValue>).delivery_outcome ===
            STILL_BIRTH_TERMINATION;

        try {
            setSaving(true);
            const response = await updateUserData(payload);
            if (response.success) {
                await syncUserData(userToken);

                // Refresh the local copy so `hadStillBirth` reflects the write on any
                // subsequent save in this session.
                const refreshed = await chatDB.getUserData(userId);
                if (refreshed) {
                    setUserData(refreshed.data);
                }

                // No parameters: every field on this form (name, dates, pregnancy
                // status) is either PII or health data.
                track(AnalyticsEvent.PROFILE_UPDATED);

                if (nowStillBirth && !hadStillBirth) {
                    // The acknowledgement carries the confirmation; a cheerful
                    // "Profile updated successfully!" toast under it would jar.
                    setShowStillBirthSupport(true);
                } else {
                    Toast.show({
                        type: "success",
                        text1: t("common.success"),
                        text2: t("editProfile.updateSuccess"),
                        position: "bottom",
                    });
                }
            } else {
                Toast.show({
                    type: "error",
                    text1: t("common.error"),
                    text2: response.message || t("editProfile.updateFailed"),
                    position: "bottom",
                });
            }
        } catch (error: any) {
            const status = error?.response?.status;
            const message =
                status === 409 || status === 403
                    ? error?.response?.data?.message || t("editProfile.conflictError")
                    : t("editProfile.updateError");
            console.error("Error updating profile:", error);
            recordError(error, 'EditProfile.handleSave');
            Toast.show({
                type: "error",
                text1: t("common.error"),
                text2: message,
                position: "bottom",
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
                <ActivityIndicator color={colors.darkPurple} size="large" />
            </View>
        );
    }

    if (loadError) {
        return (
            <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
                <Text style={[styles.readOnlyValue, globalStyles.fontRegular, { textAlign: "center" }]}>
                    {t("editProfile.loadError")}
                </Text>
            </View>
        );
    }

    const renderReadOnlyContact = (label: string, value: string) => (
        <View style={styles.fieldBlock}>
            <Text style={[styles.questionLabel, globalStyles.fontSemiBold]}>{label}</Text>
            <Text style={[styles.readOnlyValue, globalStyles.fontRegular]}>{value}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <ScrollView
                // Header covers the top inset; the bottom is unprotected without this,
                // which clips the save button under the gesture bar at targetSdk 36.
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: 40 + insets.bottom },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Contact information — read-only, only rendered when a value exists */}
                {(hasEmail || hasPhone) && (
                    <View style={styles.card}>
                        <Text style={[styles.sectionHeader, globalStyles.fontBold]}>
                            {t("editProfile.contactInfo")}
                        </Text>
                        {hasEmail && renderReadOnlyContact(t("editProfile.email"), user!.email)}
                        {hasPhone &&
                            renderReadOnlyContact(
                                t("editProfile.phoneNumber"),
                                user!.country_code
                                    ? `${user!.country_code} ${user!.mobile_number}`
                                    : (user!.mobile_number as string),
                            )}
                    </View>
                )}

                {/* Onboarding answers */}
                <View style={styles.card}>
                    <Text style={[styles.sectionHeader, globalStyles.fontBold]}>
                        {t("editProfile.aboutYou")}
                    </Text>
                    {nodes.map(node => {
                        const field = NODE_ID_TO_ONBOARDING_FIELD[node.id];
                        if (!field) return null;
                        if (field === "feeding_method" && !isPostpartum) return null;

                        const isDelivery = node.id === DELIVERY_DATE_NODE_ID;
                        if (isDelivery && !deliveryEditable) {
                            const dd = user?.onboarding_data.delivery_date;
                            return (
                                <View key={node.id} style={styles.fieldBlock}>
                                    <Text style={[styles.questionLabel, globalStyles.fontSemiBold]}>
                                        {node.text}
                                    </Text>
                                    <Text style={[styles.readOnlyValue, globalStyles.fontRegular]}>
                                        {dd
                                            ? new Date(dd as any).toLocaleDateString("en-GB", {
                                                  day: "2-digit",
                                                  month: "2-digit",
                                                  year: "numeric",
                                              })
                                            : "—"}
                                    </Text>
                                    <Text style={[styles.helperText, globalStyles.fontRegular]}>
                                        {t("editProfile.deliveryDateLocked")}
                                    </Text>
                                </View>
                            );
                        }

                        // Delivery outcome and type only apply once the baby has
                        // arrived, so they stay locked while the date is ahead of us.
                        const isPostDelivery = (
                            POST_DELIVERY_FIELDS as readonly string[]
                        ).includes(field);
                        const lockedUntilBirth = isPostDelivery && deliveryDateIsFuture;
                        const isMissing =
                            isPostDelivery &&
                            (missingPostDeliveryAnswers as readonly string[]).includes(field);

                        return (
                            <View key={node.id} style={styles.fieldBlock}>
                                <Text style={[styles.questionLabel, globalStyles.fontSemiBold]}>
                                    {node.text}
                                </Text>
                                <View style={lockedUntilBirth && { opacity: 0.45 }}>
                                    <OnboardingAnswerInput
                                        node={node}
                                        value={answers[field] ?? null}
                                        onChange={value => updateAnswer(field, value)}
                                        disabled={lockedUntilBirth}
                                    />
                                </View>
                                {lockedUntilBirth && (
                                    <Text style={[styles.helperText, globalStyles.fontRegular]}>
                                        {t("editProfile.availableAfterBirth")}
                                    </Text>
                                )}
                                {isMissing && (
                                    <Text style={[styles.errorText, globalStyles.fontRegular]}>
                                        {t("editProfile.answerRequired")}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </View>

                {saveBlocked && (
                    <Text
                        style={[
                            styles.errorText,
                            globalStyles.fontRegular,
                            { textAlign: "center", marginTop: 12 },
                        ]}
                    >
                        {t("editProfile.deliveryDetailsRequired")}
                    </Text>
                )}

                <TouchableOpacity
                    onPress={handleSave}
                    style={{ marginVertical: 20 }}
                    disabled={saving || saveBlocked}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[colors.darkPurple, colors.purple]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.saveButton, (saving || saveBlocked) && { opacity: 0.6 }]}
                    >
                        {saving ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={[styles.saveText, globalStyles.fontRegular]}>
                                {t("common.save")}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>

            <StillBirthSupportModal
                visible={showStillBirthSupport}
                onConsultExpert={() =>
                    leaveTo(() =>
                        navigation.navigate("DashboardTabNavigator", { screen: "Experts" }),
                    )
                }
                onChatWithViva={() => leaveTo(() => navigation.navigate("ChatWithVivaAI"))}
                onDismiss={() => setShowStillBirthSupport(false)}
            />
        </View>
    );
};

export default EditProfile;
