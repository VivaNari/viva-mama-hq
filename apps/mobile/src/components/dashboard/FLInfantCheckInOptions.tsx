import { View, Text, Touchable, TouchableOpacity } from "react-native"
import { globalStyles } from "../../public/styles"
import { IInfantCheckinOptions } from "../../types/infantData.types"
import { colors } from "../../public/assets/colors"

const FLInfantCheckInOptions = ({ item }: { item: IInfantCheckinOptions }) => {
    return (
        <TouchableOpacity
            style={{
                backgroundColor: 'rgba(139, 128, 252, 1)',
                flex: 1,
                // flexShrink: 1,
                paddingHorizontal: 8,
                paddingVertical: 15,
                borderRadius: 10,
                marginVertical: 5
            }}
        >
            <Text
                style={[{
                    fontSize: 14,
                    textAlign: 'center',
                    color: colors.white
                }, globalStyles.fontBold]}
            >
                {item.title}
            </Text>
        </TouchableOpacity>
    )
}

export default FLInfantCheckInOptions