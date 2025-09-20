import { Image, Text, TouchableOpacity, View } from "react-native";
import { globalStyles } from "../../public/styles";
import { ICategory } from "../../types/content.types";

const FLCategoryItem = ({ item, navigation }: { item: ICategory, navigation: { navigate: any } }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('CategoryArticles', { categoryId: item.id })}
        >
            <View
                style={{
                    alignItems: 'center',
                    paddingBottom: 5
                }}
            >
                <Image
                    source={item.categoryIcon}
                    width={200}
                    height={100}
                />
            </View>
            <Text
                style={[{
                    fontSize: 12,
                    marginTop: 2

                }, globalStyles.fontRegular]}
            >
                {item.categoryName}
            </Text>
        </TouchableOpacity>
    )
}

export default FLCategoryItem;