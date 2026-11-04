import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TextInput,
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
import { CareModelEnum, UserCategoryEnum } from "../types/user.types";
import { syncUserData } from "../utils/syncUserData";
import {
    OnboardingDataPatch,
    UpdateUserDataPayload,
    updateUserData,
} from "../api/updateuserData";
import { getFlowDefinition, IFlowDefinitionNode } from "../api/flowDefinition.api";
import { addMotherLog, getMotherLogs } from "../api/motherLogs.api";
import {
    COUNT_FIELD_BOUNDS,
    HIDDEN_FOR_NOT_PREGNANT,
    NODE_ID_TO_ONBOARDING_FIELD,
} from "../constants/onboardingFieldMap";
import {
    ABHA_NUMBER_LENGTH,
    DELIVERY_DATE_NODE_ID,
    FLOW_SLUGS,
    STILL_BIRTH_TERMINATION,
    normalizeAbhaNumber,
} from "../constants/chat";
import AbhaCardInput from "../components/onboarding/AbhaCardInput";
import { WEIGHT_KG_BOUNDS } from "../utils/measurementUnits";
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
    // These are edited as their own fields rather than through flow nodes, and their nodes
    // stay out of onboardingFieldMap so they are not shown twice:
    //  - Height and weight are typed here in cm and kg, with no unit toggle.
    //  - Care model has to work before the onboarding migration has run, because the logs
    //    screens send her here to set it.
    const [heightInput, setHeightInput] = useState("");
    const [weightInput, setWeightInput] = useState("");
    const [savedWeight, setSavedWeight] = useState("");
    const [careModel, setCareModel] = useState<string | null>(null);
    const [abhaInput, setAbhaInput] = useState("");
    const [showAbhaCard, setShowAbhaCard] = useState(false);

    const user = userData?.user;

    useEffect(() => {
        const stored = user?.onboarding_data?.height_cm;
        setHeightInput(stored ? String(stored) : "");
        setCareModel(user?.onboarding_data?.care_model ?? null);
    }, [user]);

    // Her latest weight lives in the weight log. Only a change adds a new entry.
    useEffect(() => {
        getMotherLogs({ types: ["weight"], limit: 1 })
            .then(([latest]) => {
                const kg = latest?.fields?.weightKg;
                const text = kg ? String(kg) : "";
                setWeightInput(text);
                setSavedWeight(text);
            })
            .catch(error => recordError(error, "EditProfile.loadWeight"));
    }, []);

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
    const isNotPregnant = user?.user_category === UserCategoryEnum.NN;

    /** Fields hidden for her right now, which must also stay out of the save. */
    const isFieldHidden = (field: string): boolean => {
        if (field === "feeding_method" && !isPostpartum) return true;
        if (isNotPregnant && HIDDEN_FOR_NOT_PREGNANT.includes(field)) return true;
        return !!COUNT_FIELD_BOUNDS[field] && answers.parity !== "multiparous";
    };

    const showError = (key: string) =>
        Toast.show({
            type: "error",
            text1: t("common.error"),
            text2: t(key),
            position: "bottom",
        });

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
            // The counts are numbers, but the form edits them as text.
            seeded[field] = (
                COUNT_FIELD_BOUNDS[field] && current != null ? String(current) : (current ?? null)
            ) as AnswerValue;
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
            if (isFieldHidden(field)) continue;

            const bounds = COUNT_FIELD_BOUNDS[field];
            if (bounds) {
                const typed = String(answers[field] ?? "").trim();
                const count = typed ? Number(typed) : null;
                if (
                    count !== null &&
                    (!Number.isInteger(count) || count < bounds.min || count > bounds.max)
                ) {
                    showError("editProfile.countInvalid");
                    return;
                }
                (onboardingPatch as Record<string, number | null>)[field] = count;
                continue;
            }

            (onboardingPatch as Record<string, AnswerValue>)[field] = answers[field] ?? null;
        }

        if (careModel) {
            onboardingPatch.care_model = careModel as CareModelEnum;
        }

        // Blank leaves her number as it is. The server encrypts whatever is sent.
        if (abhaInput.trim()) {
            const digits = normalizeAbhaNumber(abhaInput);
            if (!digits) {
                showError("chat.abha.invalidNumber");
                return;
            }
            (onboardingPatch as Record<string, string>).abha_number = digits;
        }

        const trimmedWeight = weightInput.trim();
        const weightChanged = trimmedWeight !== "" && trimmedWeight !== savedWeight;
        const weightKg = Number(trimmedWeight);
        if (
            weightChanged &&
            (!Number.isFinite(weightKg) ||
                weightKg < WEIGHT_KG_BOUNDS.min ||
                weightKg > WEIGHT_KG_BOUNDS.max)
        ) {
            showError("editProfile.weightInvalid");
            return;
        }

        // Blank clears it; anything else must be a whole height the backend accepts.
        const trimmedHeight = heightInput.trim();
        const heightCm = trimmedHeight ? Number(trimmedHeight) : null;
        if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 220)) {
            Toast.show({
                type: "error",
                text1: t("common.error"),
                text2: t("editProfile.heightInvalid"),
                position: "bottom",
            });
            return;
        }
        onboardingPatch.height_cm = heightCm === null ? null : Math.round(heightCm);

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
                if (weightChanged) {
                    await addMotherLog("weight", { weightKg: Math.round(weightKg * 10) / 10 });
                    setSavedWeight(trimmedWeight);
                }
                setAbhaInput("");
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

    // Built here rather than read from the flow, so it works before the migration has run.
    const careModelNode = {
        id: "care_model",
        nodeType: "QUESTION_SINGLE",
        text: t("editProfile.careModel"),
        options: [
            { label: t("editProfile.careModelPublic"), value: CareModelEnum.PUBLIC },
            { label: t("editProfile.careModelPrivate"), value: CareModelEnum.PRIVATE },
        ],
    } as unknown as IFlowDefinitionNode;

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
                        if (isFieldHidden(field)) return null;

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
                                        keyboardType={
                                            COUNT_FIELD_BOUNDS[field] ? "number-pad" : "default"
                                        }
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

                    <View style={styles.fieldBlock}>
                        <Text style={[styles.questionLabel, globalStyles.fontSemiBold]}>
                            {t("editProfile.height")}
                        </Text>
                        <View style={styles.input}>
                            <TextInput
                                placeholderTextColor={colors.gray}
                                style={[styles.inputFocusedValue, globalStyles.fontRegular]}
                                placeholder={t("editProfile.heightPlaceholder")}
                                value={heightInput}
                                onChangeText={text => setHeightInput(text.replace(/[^0-9]/g, ""))}
                                keyboardType="number-pad"
                                maxLength={3}
                            />
                        </View>
                    </View>

                    <View style={styles.fieldBlock}>
                        <Text style={[styles.questionLabel, globalStyles.fontSemiBold]}>
                            {t("editProfile.weight")}
                        </Text>
                        <View style={styles.input}>
                            <TextInput
                                placeholderTextColor={colors.gray}
                                style={[styles.inputFocusedValue, globalStyles.fontRegular]}
                                placeholder={t("editProfile.weightPlaceholder")}
                                value={weightInput}
                                onChangeText={text => setWeightInput(text.replace(/[^0-9.]/g, ""))}
                                keyboardType="decimal-pad"
                                maxLength={5}
                            />
                        </View>
                    </View>

                    <View style={styles.fieldBlock}>
                        <Text style={[styles.questionLabel, globalStyles.fontSemiBold]}>
                            {t("editProfile.careModel")}
                        </Text>
                        <OnboardingAnswerInput
                            node={careModelNode}
                            value={careModel}
                            onChange={value => setCareModel(value as string)}
                        />
                        {!careModel && (
                            <Text style={[styles.helperText, globalStyles.fontRegular]}>
                                {t("editProfile.careModelNeeded")}
                            </Text>
                        )}
                    </View>

                    <View style={styles.fieldBlock}>
                        <Text style={[styles.questionLabel, globalStyles.fontSemiBold]}>
                            {t("editProfile.abhaNumber")}
                        </Text>
                        <View style={styles.input}>
                            <TextInput
                                placeholderTextColor={colors.gray}
                                style={[styles.inputFocusedValue, globalStyles.fontRegular]}
                                placeholder={
                                    user?.onboarding_data?.abha_number_last4
                                        ? `**********${user.onboarding_data.abha_number_last4}`
                                        : t("chat.abha.numberPlaceholder")
                                }
                                value={abhaInput}
                                onChangeText={setAbhaInput}
                                keyboardType="number-pad"
                                maxLength={ABHA_NUMBER_LENGTH + 3}
                            />
                        </View>
                        {user?.onboarding_data?.abha_record_id && !showAbhaCard ? (
                            <Text style={[styles.helperText, globalStyles.fontRegular]}>
                                {t("editProfile.abhaCardSaved")}
                            </Text>
                        ) : null}
                        {showAbhaCard ? (
                            <AbhaCardInput
                                allowAlternatives={false}
                                onSubmit={async () => {
                                    setShowAbhaCard(false);
                                    if (userToken) await syncUserData(userToken);
                                    const refreshed = await chatDB.getUserData(userId as string);
                                    if (refreshed) setUserData(refreshed.data);
                                    Toast.show({
                                        type: "success",
                                        text1: t("common.success"),
                                        text2: t("chat.abha.cardAdded"),
                                        position: "bottom",
                                    });
                                }}
                            />
                        ) : (
                            <TouchableOpacity
                                onPress={() => setShowAbhaCard(true)}
                                accessibilityRole="button"
                            >
                                <Text
                                    style={[
                                        globalStyles.fontSemiBold,
                                        { color: colors.darkPurple, marginTop: 8 },
                                    ]}
                                >
                                    {t("editProfile.abhaCardUpload")}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
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
