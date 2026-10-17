import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { getAIMessageBookmarks } from '../api/getAIMessageBookmarks';
import { removeAIMessageBookmark } from '../api/removeAIMessageBookmark';
import { reportAIMessage } from '../api/reportAIMessage';
import ReportSheet from '../components/vivaClub/ReportSheet';
import { AI_REPORT_REASONS } from '../constants/moderation';
import { ReportReason } from '../types/vivaClub.types';
import { AnalyticsEvent, recordError, track } from '../analytics';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { BackendAiMessage, BookmarkedMessageResponse } from '../types/bookmarkedMessages.types';
import { chatDB } from '../db/sqlite';


const BookmarkedMessages: React.FC = () => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [bookmarks, setBookmarks] = useState<BackendAiMessage[]>([]);
    // Held as an id rather than a boolean so the sheet cannot drift onto another row.
    const [flaggingMessageId, setFlaggingMessageId] = useState<string | null>(null);
    const [flagSubmitting, setFlagSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchBookmarks = useCallback(async () => {
        try {
            const data = (await getAIMessageBookmarks()) as BookmarkedMessageResponse;
            console.log("data is ", data)
            setBookmarks(data.data.map((bookmark) => bookmark.messageId));
        } catch (error) {
            console.error('Failed to fetch bookmarks', error);
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('bookmarks.loadFailed'),
            });
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [t]);

    useEffect(() => {
        fetchBookmarks();
    }, [fetchBookmarks]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchBookmarks();
    }, [fetchBookmarks]);

    const handleUnbookmark = async (item: BackendAiMessage) => {
        try {
            await removeAIMessageBookmark(item._id);
            await chatDB.deleteBookmark(item._id);
            Toast.show({
                type: 'success',
                text1: t('chat.bookmarkRemoved'),
            });
        } catch (error) {
            console.error('Failed to remove bookmark', error);
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('bookmarks.removeFailed'),
            });
        } finally {
            fetchBookmarks();
        }
    };

    const renderItem = ({ item }: { item: BackendAiMessage }) => (
        <View style={styles.card}>
            <View style={styles.contentContainer}>
                <Text style={[styles.messageText, globalStyles.fontRegular]}>
                    {item.text}
                </Text>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                        Alert.alert(
                            t('bookmarks.confirmTitle'),
                            t('bookmarks.confirmMessage'),
                            [
                                {
                                    text: t('common.cancel'),
                                    onPress: () => console.log('Canceled'),
                                    style: 'cancel',
                                },
                                {
                                    text: t('bookmarks.delete'),
                                    onPress: () => handleUnbookmark(item),
                                    style: 'destructive',
                                },
                            ],
                            { cancelable: true }
                        );
                    }}
                >
                    <MaterialDesignIcons name="delete-outline" size={24} color={colors.error} />
                </TouchableOpacity>

                {/* A saved reply is still model output, and this may well be where she
                    re-reads it and decides it was wrong. Requiring her to find the
                    original in the thread to flag it would be the "exit the app to
                    report" problem in miniature. */}
                <TouchableOpacity
                    style={styles.deleteButton}
                    hitSlop={8}
                    accessibilityLabel={t('chat.reportAccessibility')}
                    onPress={() => setFlaggingMessageId(item._id)}
                >
                    <MaterialDesignIcons name="flag-outline" size={22} color={colors.darkGray} />
                </TouchableOpacity>
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.darkPurple} />
            </View>
        );
    }

    // No paddingTop: this screen is registered with `headerShown: true`, so the
    // navigator header already consumes the top inset. Adding it here double-padded
    // the list — visible once edge-to-edge makes insets.top actually non-zero.
    const submitFlag = async (reason: ReportReason, details: string) => {
        if (!flaggingMessageId) return;
        setFlagSubmitting(true);
        try {
            await reportAIMessage({ messageId: flaggingMessageId, reason, details });
            track(AnalyticsEvent.AI_MESSAGE_REPORTED, { reason });
            setFlaggingMessageId(null);
            Toast.show({
                type: 'success',
                text1: t('chat.reportThanks'),
                text2: t('chat.reportThanksBody'),
            });
        } catch (error) {
            recordError(error, 'BookmarkedMessages.submitFlag');
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('chat.actionFailed'),
            });
        } finally {
            setFlagSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <ReportSheet
                visible={!!flaggingMessageId}
                submitting={flagSubmitting}
                subjectKey="chat.reportSubject"
                reasons={AI_REPORT_REASONS}
                noticeKey="chat.reportNotice"
                onSubmit={submitFlag}
                onDismiss={() => setFlaggingMessageId(null)}
            />
            <FlatList
                data={bookmarks}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: styles.listContent.paddingBottom + insets.bottom },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.darkPurple}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.center}>
                        <Text style={[styles.emptyText, globalStyles.fontMedium]}>
                            {t('bookmarks.empty')}
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    contentContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    messageText: {
        flex: 1,
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
        marginRight: 12,
    },
    deleteButton: {
        padding: 4,
    },
    emptyText: {
        fontSize: 16,
        color: colors.gray,
        marginTop: 40,
    },
});

export default BookmarkedMessages;
