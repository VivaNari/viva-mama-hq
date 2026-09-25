import Lucide from '@react-native-vector-icons/lucide';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';
import { AnalyticsEvent, recordError, track } from '../../analytics';
import {
    blockUser,
    deleteOwnComment,
    deleteOwnPost,
    reportContent,
} from '../../api/vivaClubModeration';
import { colors } from '../../public/assets/colors';
import { ReportReason, ReportTargetType } from '../../types/vivaClub.types';
import ContentActionsMenu, { TContentAction } from './ContentActionsMenu';
import ReportSheet from './ReportSheet';

export interface IModerationTarget {
    type: ReportTargetType;
    id: string;
    authorId?: string;
    isOwn: boolean;
    /** Required to delete a comment — the route is nested under its post. */
    postId?: string;
}

interface IContentModerationButtonProps {
    target: IModerationTarget;
    /**
     * Called after any action that changes what the server will return.
     *
     * Receives the action, because the right response differs: deleting or blocking
     * removes the content from view, while a report leaves it visible until enough
     * other people agree. A screen showing only this item has to leave on the first
     * two and stay put on the third.
     */
    onChanged: (action: TContentAction) => void;
    size?: number;
}

/**
 * The overflow control on a post or comment, owning the whole flow behind it: the
 * action menu, the report sheet, the API calls and the confirmations.
 *
 * Packaged as one component because it appears in two places with different layouts —
 * the feed card and a comment row — and duplicating four pieces of state across both
 * is how the two copies drift apart.
 *
 * Nothing is hidden locally. Every action ends in `onChanged()` and the screen refetches,
 * so the server's filters remain the single authority on what is visible.
 */
const ContentModerationButton = ({
    target,
    onChanged,
    size = 18,
}: IContentModerationButtonProps) => {
    const { t } = useTranslation();
    const [menuVisible, setMenuVisible] = useState(false);
    const [reportVisible, setReportVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const isPost = target.type === 'VIVA_CLUB_POST';

    const handleDelete = () => {
        Alert.alert(
            t(isPost ? 'vivaClub.deletePostTitle' : 'vivaClub.deleteCommentTitle'),
            t('vivaClub.deleteBody'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('vivaClub.actionDelete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (isPost) {
                                await deleteOwnPost(target.id);
                            } else {
                                await deleteOwnComment(target.postId ?? '', target.id);
                            }
                            track(AnalyticsEvent.COMMUNITY_CONTENT_DELETED, {
                                target_type: target.type,
                            });
                            onChanged('DELETE');
                        } catch (error) {
                            recordError(error, 'ContentModerationButton.delete');
                            Toast.show({
                                type: 'error',
                                text1: t('common.error'),
                                text2: t('vivaClub.actionFailed'),
                            });
                        }
                    },
                },
            ],
        );
    };

    const handleBlock = () => {
        if (!target.authorId) return;
        Alert.alert(t('vivaClub.blockTitle'), t('vivaClub.blockBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('vivaClub.actionBlock'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await blockUser(target.authorId!);
                        track(AnalyticsEvent.COMMUNITY_USER_BLOCKED);
                        Toast.show({ type: 'success', text1: t('vivaClub.blockDone') });
                        onChanged('BLOCK');
                    } catch (error) {
                        recordError(error, 'ContentModerationButton.block');
                        Toast.show({
                            type: 'error',
                            text1: t('common.error'),
                            text2: t('vivaClub.actionFailed'),
                        });
                    }
                },
            },
        ]);
    };

    const handleAction = (action: TContentAction) => {
        if (action === 'DELETE') return handleDelete();
        if (action === 'BLOCK') return handleBlock();
        setReportVisible(true);
    };

    const submitReport = async (reason: ReportReason, details: string) => {
        setSubmitting(true);
        try {
            await reportContent({
                targetType: target.type,
                targetId: target.id,
                reason,
                details,
            });
            // The reason, never the content. A report body can quote exactly the abuse
            // or health disclosure that made it worth reporting.
            track(AnalyticsEvent.COMMUNITY_CONTENT_REPORTED, {
                target_type: target.type,
                reason,
            });
            setReportVisible(false);
            Toast.show({
                type: 'success',
                text1: t('vivaClub.reportThanks'),
                text2: t('vivaClub.reportThanksBody'),
            });
            onChanged('REPORT');
        } catch (error) {
            recordError(error, 'ContentModerationButton.report');
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('vivaClub.actionFailed'),
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                hitSlop={10}
                accessibilityLabel={t('vivaClub.actionsAccessibility')}
            >
                <Lucide name="ellipsis-vertical" size={size} color={colors.darkGray} />
            </TouchableOpacity>

            <ContentActionsMenu
                visible={menuVisible}
                isOwn={target.isOwn}
                onClose={() => setMenuVisible(false)}
                onSelect={handleAction}
            />

            <ReportSheet
                visible={reportVisible}
                submitting={submitting}
                subjectKey={
                    isPost ? 'vivaClub.reportSubjectPost' : 'vivaClub.reportSubjectComment'
                }
                onSubmit={submitReport}
                onDismiss={() => setReportVisible(false)}
            />
        </>
    );
};

export default ContentModerationButton;
