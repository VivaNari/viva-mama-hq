import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
    FlatList,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { notifications } from "../data/notificationData";
import { globalStyles } from "../public/styles";
import { styles } from "../public/styles/notificationStyles";
import { INotification } from "../types/notification.types";

const NotificationScreen = () => {
    const navigation = useNavigation<any>();

    const renderItem = ({ item }: { item: INotification }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => {
                if (item.targetScreen) {
                    navigation.navigate(item.targetScreen, item.params || {});
                }
            }}
        >
            <Text style={[styles.title, globalStyles.fontMedium]}>{item.title}</Text>
            <Text style={[styles.message, globalStyles.fontRegular]} numberOfLines={2}>
                {item.message}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16 }}
            />
        </View>
    );
};

export default NotificationScreen;