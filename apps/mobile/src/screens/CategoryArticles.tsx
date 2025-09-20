import { useRoute } from "@react-navigation/native";
import React from "react";
import {
    FlatList,
    Image,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArticleCard } from "../components/ArticleCard";
import { contentsData } from "../data/contentsData";
import { globalStyles } from "../public/styles";
import { styles } from "../public/styles/contentStyles";
import { ICategory, ISubCategory } from "../types/content.types";

const SubCategoryBlock = ({ item }: { item: ISubCategory }) => {
    return (
        <View style={styles.subCategoryBlock}>
            <FlatList
                data={item.contents}
                keyExtractor={(c) => c.id.toString()}
                renderItem={({ item }) => <ArticleCard item={item} />}
                scrollEnabled={false}
            />
        </View>
    );
};

// @TODO: Make the header transparent

const CategoryScreen = ({ category }: { category: ICategory }) => {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            {/* Header Image */}
            <Image
                source={category.categoryThumbnailImage}
                style={styles.headerImage}
            />
            <View style={[globalStyles.container]}>
                {/* Category Name */}
                <Text
                    style={[
                        styles.headerTitle,
                        globalStyles.fontBold
                    ]}
                >
                    {category.categoryName}
                </Text>

                {/* Subcategories with articles */}
                <FlatList
                    data={category.subCategories}
                    keyExtractor={(s) => s.id.toString()}
                    renderItem={({ item }) => <SubCategoryBlock item={item} />}
                    contentContainerStyle={{ paddingBottom: 30 }}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </SafeAreaView>
    );
};

interface CategoryParams {
    params: {
        categoryId: number;
    };
}
const CategoryArticles = () => {
    const { params } = useRoute() as CategoryParams;
    const category = contentsData.find((c) => c.id === params.categoryId)!;
    return <CategoryScreen category={category} />;
};

export default CategoryArticles;

