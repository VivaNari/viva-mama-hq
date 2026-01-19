import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { getAIMessageBookmarks } from '../api/getAIMessageBookmarks';
import { removeAIMessageBookmark } from '../api/removeAIMessageBookmark';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { BackendAiMessage, BookmarkedMessageResponse } from '../types/bookmarkedMessages.types';


const BookmarkedMessages: React.FC = () => {
    const insets = useSafeAreaInsets();
    const [bookmarks, setBookmarks] = useState<BackendAiMessage[]>([]);
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
                text1: 'Error',
                text2: 'Failed to load bookmarks',
            });
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

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
            Toast.show({
                type: 'success',
                text1: 'Bookmark Removed',
            });
        } catch (error) {
            console.error('Failed to remove bookmark', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to remove bookmark',
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
                            'Confirm Action',
                            'Are you sure you want to delete this item?',
                            [
                                {
                                    text: 'Cancel',
                                    onPress: () => console.log('Canceled'),
                                    style: 'cancel',
                                },
                                {
                                    text: 'Delete',
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
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={colors.darkPurple} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <FlatList
                data={bookmarks}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContent}
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
                            No bookmarked messages yet
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
