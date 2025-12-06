import React, { useMemo, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import FLCategoryItem from '../components/community/FLCategoryItem'
import FLSubCategoryItem from '../components/community/FLSubCategoryItem'
import SearchInput from '../components/SearchInput'
import { contentsData } from '../data/contentsData'
import { globalStyles } from '../public/styles'
import { ICategory } from '../types/content.types'
import { colors } from '../public/assets/colors'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import FLVivaClubPostItem from '../components/vivaClub/FLVivaClubPostItem'
import { vivaClubData } from '../data/vivaClubData'
import { ArticleCard } from '../components/ArticleCard'
import DashboardCard from '../components/dashboard/DashboardCard'

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
                        {/* Viva club redirect button */}
                        <View
                            style={{
                                paddingHorizontal: 5
                            }}
                        >
                            <DashboardCard>
                                <FLVivaClubPostItem
                                    isFromCommunityScreen={true}
                                    item={vivaClubData[0]}
                                />
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        paddingBottom: 20,

                                    }}
                                >

                                    <GradientButtonWithSlightRadius
                                        title='Go to Viva Club'
                                        onPress={() => navigation.navigate("VivaClub")}
                                    />
                                </View>
                            </DashboardCard>
                        </View>
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
