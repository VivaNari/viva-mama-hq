import React from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArticleCard } from "../components/ArticleCard";
import { contentsData } from "../data/contentsData";
import { ISubCategory } from "../types/content.types";
import { useRoute } from "@react-navigation/native";
import { globalStyles } from "../public/styles";
import { SubCategoryStyles } from "../public/styles/contentStyles";

const SubCategoryBlock = ({ item }: { item: ISubCategory }) => {
    return (
        <View style={SubCategoryStyles.subCategoryBlock}>
            <Text style={[
                SubCategoryStyles.headerTitle,
                globalStyles.fontBold
            ]}>
                {item.subCategoryName}
            </Text>
            <FlatList
                data={item.contents}
                keyExtractor={(c) => c.id.toString()}
                renderItem={({ item }) => <ArticleCard item={item} />}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
};

const SubCategoryArticles = () => {
    const route = useRoute<any>();
    const { subCategoryId } = route.params;

    // find subcategory by id in contentsData
    let subCategory: ISubCategory | undefined;
    for (const category of contentsData) {
        const found = category.subCategories.find((s) => s.id === subCategoryId);
        if (found) {
            subCategory = found;
            break;
        }
    }

    if (!subCategory) {
        return (
            <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text>No articles found.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[globalStyles.container]}>
            <SubCategoryBlock item={subCategory} />
        </SafeAreaView>
    );
};

export default SubCategoryArticles;


