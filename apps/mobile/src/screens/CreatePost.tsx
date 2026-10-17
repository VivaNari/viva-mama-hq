import { View, Text, Image, TextInput } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { globalStyles } from '../public/styles'
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import { useNavigation } from '@react-navigation/native'
import apiClientInterceptor from '../api/apiClientInterceptor'
import { API_VIVA_CLUB_CREATE_POST } from '../constants/endpoints'
import Toast from 'react-native-toast-message'
import { useCapability, useSubscriptionContext } from '../context/SubscriptionContext'
import { Capability } from '../types/entitlements.types'
import { colors } from '../public/assets/colors'
import { AnalyticsEvent, recordError, track } from '../analytics'
import { getGuidelinesStatus } from '../api/vivaClubModeration'
import CommunityGuidelinesGate from '../components/vivaClub/CommunityGuidelinesGate'

const CreatePost = () => {
    const { t } = useTranslation();
    const [postText, setPostText] = useState<string>("")

    // The cap comes from the server, not from a constant here — the free/premium
    // difference is a product lever that must be tunable without an app release.
    // 250 was previously hardcoded for every tier.
    const postCap = useCapability(Capability.COMMUNITY_POST);
    const { openPaywall } = useSubscriptionContext();
    const maxChars = postCap.maxChars ?? 250;
    const atLimit = postText.length >= maxChars;
    const [loading, setLoading] = useState<boolean>(false)
    const [needsGuidelines, setNeedsGuidelines] = useState<boolean>(false);
    const [showGuidelines, setShowGuidelines] = useState<boolean>(false);
    const navigation = useNavigation<any>();

    // Checked on mount so the gate can be shown before anything is typed, rather than
    // after — losing a draft to a consent screen is the worst moment to ask.
    useEffect(() => {
        (async () => {
            try {
                const status = await getGuidelinesStatus();
                setNeedsGuidelines(!status.accepted);
            } catch (error) {
                // A failed check must not block posting: the server gates it anyway and
                // will answer GUIDELINES_NOT_ACCEPTED if it really is required.
                recordError(error, 'CreatePost.guidelinesStatus');
            }
        })();
    }, []);

    /**
     * `skipGuidelinesCheck` exists because of a stale-closure trap.
     *
     * The accept handler calls setNeedsGuidelines(false) and then publish() in the same
     * tick. State updates are asynchronous, so the publish call still closes over the
     * old `needsGuidelines === true` and would re-open the gate it was just dismissed
     * from — forever, one reopen per acceptance. Passing the fact explicitly is what
     * breaks the cycle; reading it from state cannot.
     */
    const publish = async (skipGuidelinesCheck = false) => {
        if (!postText.trim()) return;

        if (needsGuidelines && !skipGuidelinesCheck) {
            setShowGuidelines(true);
            return;
        }

        try {
            setLoading(true);
            await apiClientInterceptor().post(API_VIVA_CLUB_CREATE_POST, {
                content: postText,
                mediaUrls: []
            });
            Toast.show({
                type: 'success',
                text1: t('common.success'),
                text2: t('vivaClub.publishSuccess')
            });
            // That a post was made, never what it said.
            track(AnalyticsEvent.COMMUNITY_POST_CREATED);
            navigation.navigate("VivaClub");
        } catch (error) {
            console.error("Failed to create post", error);
            const denial = (error as any)?.response?.data?.data?.code;

            // The server is the authority on whether acceptance is needed. The mount-time
            // check can miss — a network blip leaves needsGuidelines false — and without
            // this the user gets "couldn't publish" with no way to reach the gate.
            if (denial === 'GUIDELINES_NOT_ACCEPTED') {
                setNeedsGuidelines(true);
                setShowGuidelines(true);
                return;
            }

            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: denial === 'COMMUNITY_BANNED'
                    ? t('vivaClub.bannedNotice')
                    : t('vivaClub.publishFailed')
            });
            track(AnalyticsEvent.COMMUNITY_POST_CREATE_FAILED, {
                reason: String((error as any)?.response?.status ?? 'network'),
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView
            style={globalStyles.container} edges={['bottom', 'left', 'right']}>
            <CommunityGuidelinesGate
                visible={showGuidelines}
                onAccepted={() => {
                    setNeedsGuidelines(false);
                    setShowGuidelines(false);
                    // Straight through to publishing: the user already pressed Post, and
                    // making them press it again reads as the tap having failed. The
                    // flag is passed rather than read back from state — see publish().
                    publish(true);
                }}
                onDismiss={() => setShowGuidelines(false)}
            />
            <View>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <MaterialDesignIcons
                        onPress={() => navigation.goBack()}
                        name='close'
                        size={24}
                    />
                    <GradientButtonWithSlightRadius
                        fullRounded={true}
                        title={loading ? t('vivaClub.posting') : t('vivaClub.post')}
                        onPress={() => publish()}
                        fullWidth={false}
                        disabled={loading || !postText.trim()}
                    />
                </View>

                <View>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 10,
                            marginTop: 30
                        }}
                    >
                        <Image
                            source={require("../public/assets/images/avatar_mom.png")}
                            style={{
                                height: 30,
                                width: 30,
                                borderRadius: 30,
                                objectFit: 'cover'
                            }}
                        />
                        <View
                            style={{ flex: 1 }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text
                                    style={[{
                                        fontSize: 10,
                                        color: atLimit ? colors.warning : 'rgba(0, 0, 0, 0.47)'

                                    }, globalStyles.fontMedium]}
                                >
                                    {postText.length.toString()}/{maxChars}
                                </Text>

                                {/* Shown at the cap rather than silently truncating. The
                                    draft is never discarded — losing typed text is the
                                    worst possible moment to hit a paywall. */}
                                {atLimit && !postCap.unlimited ? (
                                    <Text
                                        onPress={() => openPaywall()}
                                        style={[{ fontSize: 10, color: colors.purple }, globalStyles.fontMedium]}
                                    >
                                        {t('subscription.subscribeToWriteMore')}
                                    </Text>
                                ) : null}
                            </View>
                            <TextInput
                                style={[{
                                    fontSize: 12,
                                    color: 'rgba(0, 0, 0, 0.47)',
                                    // padding: 20
                                }, globalStyles.fontMedium]}
                                placeholder={t('vivaClub.shareThoughts')}
                                placeholderTextColor={'rgba(0, 0, 0, 0.47)'}
                                multiline={true}
                                value={postText}
                                maxLength={maxChars}
                                onChangeText={(text) => setPostText(text)}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    )
}

export default CreatePost