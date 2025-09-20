import { FlatList, Text, View } from "react-native";
import { IExpertCategory } from "../../types/expert.types";
import ExpertItem from "./FLExpertItem";
import { globalStyles } from "../../public/styles";

const ExpertCategoryItem = ({ item, navigation }: { item: IExpertCategory, navigation: { navigate: any } }) => {
    const category = item.category;
    return (
        <View
            style={{
                paddingTop: 10
            }}
        >
            <Text
                style={[{
                    fontSize: 16,
                    fontWeight: '600',
                    marginBottom: 10,
                }, globalStyles.fontSemiBold]}
            >
                {item.category}
            </Text>

            {/* Doctors List */}
            <FlatList
                keyExtractor={(doctor) => doctor.id.toString()}
                data={item.experts}
                renderItem={({ item }) => ExpertItem({ item, navigation, category: category })}
                numColumns={2}
                columnWrapperStyle={{
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                }}
            />
        </View>
    )
}

export default ExpertCategoryItem;