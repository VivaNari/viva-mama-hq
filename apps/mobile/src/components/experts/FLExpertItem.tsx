import { Dimensions, Image, Text, TouchableOpacity, View } from "react-native";
import { IExpert } from "../../types/expert.types"
import { colors } from "../../public/assets/colors";
import LinearGradient from "react-native-linear-gradient";
import { globalStyles } from "../../public/styles";
import GradientButtonWithSlightRadius from "../GradientButtonWithSlightRadius";

const { width } = Dimensions.get("window");

const ExpertItem = ({ item, navigation, category }: { item: IExpert, category: string, navigation: { navigate: any } }) => {
    return (
        <View
            style={{
                width: (width - 60) / 2,
                marginBottom: 15,
            }}
        >
            <TouchableOpacity
                activeOpacity={0.8}
                style={{
                    borderRadius: 15,
                    overflow: 'hidden',
                    padding: 10,
                    backgroundColor: colors.white
                }}
                onPress={() => navigation.navigate('ExpertDetails', { expertId: item.id, category: category })}
            >
                <Image
                    source={item.avatar}
                    resizeMode="cover"
                    style={{
                        height: 180,
                        width: '100%',
                        borderRadius: 15,
                        justifyContent: "flex-end",
                    }}
                />
                <Text
                    style={[{
                        fontSize: 12,
                        fontWeight: '500',
                        marginTop: 10,
                        textAlign: 'center',
                    }, globalStyles.fontSemiBold]}
                >
                    {item.name}
                </Text>
                <Text
                    style={[{
                        fontSize: 10,
                        fontWeight: '500',
                        textAlign: 'center',
                    }, globalStyles.fontRegular]}
                >
                    {item.remuneration}
                </Text>


                <GradientButtonWithSlightRadius
                    onPress={() => navigation.navigate('ExpertDetails', { expertId: item.id, category: category })}
                    title="Book Now"
                />
            </TouchableOpacity>
        </View>
    )
}

export default ExpertItem;