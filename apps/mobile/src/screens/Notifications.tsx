import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
} from "react-native";
import { notifications } from "../data/notificationData";
import { useNavigation } from "@react-navigation/native";
import { INotification } from "../types/notification.types";
import { colors } from "../public/assets/colors";
import { styles } from "../public/styles/notificationStyles";

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
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.message} numberOfLines={2}>
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