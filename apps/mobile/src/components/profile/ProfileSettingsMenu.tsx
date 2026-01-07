import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { TouchableOpacity, Text, View } from "react-native";
import { colors } from "../../public/assets/colors";
import { ISettingsMenu } from "../../types/myProfile.types";
import { globalStyles } from "../../public/styles";
import Lucide from "@react-native-vector-icons/lucide";

const ProfileSettingsMenu = ({ item, navigation, isFirst, isLast }: { item: ISettingsMenu, navigation: any, isFirst: boolean, isLast: boolean }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.4}
            onPress={() => navigation.navigate(`${item.componentName}`)}
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
            <Lucide name={item.icon as any} size={20} color={colors.mediumGray} />
            <View
                style={{
                    flex: 1,
                }}
            >
                <Text
                    style={[{
                        fontSize: 16,
                        flex: 1,
                        marginLeft: 10
                    }, globalStyles.fontSemiBold]}
                >
                    {item.title}
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
                    {item.description}
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