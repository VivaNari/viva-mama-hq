import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { TouchableOpacity, Text } from "react-native";
import { colors } from "../../public/assets/colors";
import { ISettingsMenu } from "../../types/myProfile.types";
import { globalStyles } from "../../public/styles";

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
                backgroundColor: colors.profileOptionsBG,
                paddingHorizontal: 10,
                borderTopLeftRadius: isFirst ? 8 : 0,
                borderTopRightRadius: isFirst ? 8 : 0,
                borderBottomLeftRadius: isLast ? 8 : 0,
                borderBottomRightRadius: isLast ? 8 : 0,
            }}
        >
            <MaterialDesignIcons name={item.icon as any} size={20} color={colors.primary} />
            <Text
                style={[{
                    fontSize: 16,
                    paddingBottom: 7,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(0, 0, 0, 0.2)',
                    flex: 1,
                    marginLeft: 10
                }, globalStyles.fontRegular]}
            >
                {item.title}
            </Text>
        </TouchableOpacity>
    )
}

export default ProfileSettingsMenu;