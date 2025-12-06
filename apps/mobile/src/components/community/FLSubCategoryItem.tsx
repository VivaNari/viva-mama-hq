import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { globalStyles } from "../../public/styles";
import { ISubCategory } from "../../types/content.types";
import FLCategoryArticle from "./FLCategoryArticle";

const FLSubCategoryItem = ({ item, navigation }: { item: ISubCategory, navigation: { navigate: any } }) => {
    return (
        <View>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between'
                }}
            >
                <Text
                    style={[{
                        fontSize: 16,

                    }, globalStyles.fontSemiBold]}
                >{item.subCategoryName}</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('SubCategoryArticles', { subCategoryId: item.id })}
                >
                    <Text
                        style={[{
                            fontSize: 14,

                        }, globalStyles.fontRegular]}
                    >
                        See All
                    </Text>
                </TouchableOpacity>

            </View>

            <FlatList
                keyExtractor={(item) => item.id.toString()}
                data={item.contents}
                renderItem={({ item }) => FLCategoryArticle({ item, navigation })}
                numColumns={2}
                columnWrapperStyle={{
                    justifyContent: 'space-between',
                    gap: 10
                }}
                style={{
                    paddingTop: 8
                }}
            />
        </View>
    )
}

export default FLSubCategoryItem;