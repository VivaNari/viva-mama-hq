import React from 'react'
import { FlatList, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import FLCategoryItem from '../components/community/FLCategoryItem'
import SearchInput from '../components/SearchInput'
import { contentsData } from '../data/contentsData'
import { globalStyles } from '../public/styles'
import { ICategory } from '../types/content.types'
import FLSubCategoryItem from '../components/community/FLSubCategoryItem'

const ArticleContent = ({ navigation }: { navigation: { navigate: any } }) => {
    return (
        <SafeAreaView style={[globalStyles.container]}>
            <FlatList
                data={contentsData}
                keyExtractor={(item: ICategory) => item.id.toString()}
                renderItem={({ item }) => (
                    <FlatList
                        keyExtractor={(sub) => sub.id.toString()}
                        data={item.subCategories}
                        renderItem={({ item }) => FLSubCategoryItem({ item, navigation })}
                        scrollEnabled={false}
                        style={{
                            marginTop: 25
                        }}
                    />
                )}
                ListHeaderComponent={
                    <>
                        {/* Search */}
                        <View style={{ marginBottom: 15 }}>
                            <SearchInput />
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
                            style={{ paddingHorizontal: 20, marginBottom: 20 }}
                            scrollEnabled={false}
                        />
                    </>
                }
                contentContainerStyle={{}} // so last item is visible above tab bar
            />

        </SafeAreaView>
    )
}

export default ArticleContent