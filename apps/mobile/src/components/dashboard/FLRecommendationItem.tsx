import { View, Text } from "react-native"
import { globalStyles } from "../../public/styles"

const FLRecommendationItem = ({ item }: { item: string }) => {
    return (
        <View
            style={{
                borderColor: 'rgba(139, 128, 252, 1)',
                borderWidth: 1,
                flex: 1,
                flexShrink: 1,
                paddingHorizontal: 8,
                paddingVertical: 15,
                borderRadius: 10,

            }}
        >
            <Text
                style={[{
                    fontSize: 12
                }, globalStyles.fontRegular]}
            >
                {item}
            </Text>
        </View>
    )
}

export default FLRecommendationItem