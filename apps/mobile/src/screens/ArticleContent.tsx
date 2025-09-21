import React, { useMemo, useState } from 'react'
import { FlatList, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import FLCategoryItem from '../components/community/FLCategoryItem'
import FLSubCategoryItem from '../components/community/FLSubCategoryItem'
import SearchInput from '../components/SearchInput'
import { contentsData } from '../data/contentsData'
import { globalStyles } from '../public/styles'
import { ICategory } from '../types/content.types'

const ArticleContent = ({ navigation }: { navigation: { navigate: any } }) => {
    const [searchData, setSearchData] = useState<string>("");

    const filteredData = useMemo(() => {
        if (!searchData.trim()) return contentsData;

        return contentsData.map(category => ({
            ...category,
            subCategories: category.subCategories.filter(sub =>
                sub.subCategoryName.toLowerCase().includes(searchData.toLowerCase())
            )
        })).filter(category => category.subCategories.length > 0); // remove empty categories
    }, [searchData]);

    return (
        <SafeAreaView style={[globalStyles.container]}>
            <FlatList
                data={filteredData}
                keyExtractor={(item: ICategory) => item.id.toString()}
                renderItem={({ item }) => (
                    <FlatList
                        keyExtractor={(sub) => sub.id.toString()}
                        data={item.subCategories}
                        renderItem={({ item }) => FLSubCategoryItem({ item, navigation })}
                        scrollEnabled={false}
                        style={{ marginTop: 25 }}
                        keyboardShouldPersistTaps="handled"
                    />
                )}
                ListHeaderComponent={
                    <>
                        {/* Search */}
                        <View style={{ marginBottom: 15 }}>
                            <SearchInput setSearchData={setSearchData} />
                        </View>

                        {/* Categories */}
                        <FlatList
                            keyExtractor={(item: ICategory) => item.id.toString()}
                            data={contentsData}
                            renderItem={({ item }) => FLCategoryItem({ item, navigation })}
                            numColumns={3}
                            columnWrapperStyle={{
                                justifyContent: 'space-between',
                                alignItems: 'flex-end',
                                flexWrap: 'wrap',
                            }}
                            style={{ paddingHorizontal: 30, marginBottom: 20 }}
                            scrollEnabled={false}
                            keyboardShouldPersistTaps="handled"
                        />
                    </>
                }
            />
        </SafeAreaView>
    )
}

export default ArticleContent
