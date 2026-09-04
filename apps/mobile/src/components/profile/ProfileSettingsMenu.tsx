import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, Text, View, Linking } from "react-native";
import { colors } from "../../public/assets/colors";
import { ISettingsMenu } from "../../types/myProfile.types";
import { globalStyles } from "../../public/styles";
import Lucide from "@react-native-vector-icons/lucide";

const ProfileSettingsMenu = ({ item, navigation, isFirst, isLast, onAction }: { item: ISettingsMenu, navigation: any, isFirst: boolean, isLast: boolean, onAction?: (action: NonNullable<ISettingsMenu["action"]>) => void }) => {
    const { t } = useTranslation();
    return (
        <TouchableOpacity
            activeOpacity={0.4}
            onPress={() => {
                if (item.action) {
                    onAction?.(item.action);
                } else if (item.componentName.startsWith('http')) {
                    Linking.openURL(item.componentName);
                } else {
                    navigation.navigate(item.componentName);
                }
            }}
            style={{
                flexDirection: "row",
                gap: 5,
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingVertical: 10,
                borderTopLeftRadius: isFirst ? 8 : 0,
                borderTopRightRadius: isFirst ? 8 : 0,
                borderBottomLeftRadius: isLast ? 8 : 0,
                borderBottomRightRadius: isLast ? 8 : 0,
            }}
        >
            <Lucide
                name={item.icon as any}
                size={20}
                color={item.destructive ? colors.error : colors.darkGray}
            />
            <View
                style={{
                    flex: 1,
                }}
            >
                <Text
                    style={[{
                        fontSize: 16,
                        flex: 1,
                        marginLeft: 10,
                        // Only account deletion sets this. Colour is the one cue that
                        // survives being read quickly, which is the point on a row that
                        // cannot be undone.
                        ...(item.destructive ? { color: colors.error } : {}),
                    }, globalStyles.fontSemiBold]}
                >
                    {t(item.titleKey)}
                </Text>
                <Text
                    style={[{
                        fontSize: 14,
                        paddingBottom: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                        flex: 1,
                        marginLeft: 10,
                        color: colors.darkGray
                    }, globalStyles.fontRegular]}
                >
                    {t(item.descriptionKey)}
                </Text>
            </View>
            <View
                style={{
                    padding: 5,
                    height: 30,
                    width: 30,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: colors.pageBG,
                    borderRadius: '50%',
                }}
            >
                <MaterialDesignIcons name={'chevron-right'} size={20} color={colors.darkPurple} />
            </View>
        </TouchableOpacity>
    )
}

export default ProfileSettingsMenu;