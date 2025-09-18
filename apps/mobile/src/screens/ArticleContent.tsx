import React from 'react'
import { Dimensions, FlatList, Image, ImageBackground, ScrollView, StyleSheet, Text, Touchable, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import SearchInput from '../components/SearchInput'
import { contentsData } from '../data/contentsData'
import { globalStyles } from '../public/styles'
import { ICategory, IContent, ISubCategory } from '../types/content.types'
import { colors } from '../public/assets/colors'

const { width } = Dimensions.get("window");

const categoryItem = ({ item, navigation }: { item: ICategory, navigation: { navigate: any } }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.6}
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
            <Text>{item.categoryName}</Text>
        </TouchableOpacity>
    )
}

const subCategoryItem = ({ item, navigation }: { item: ISubCategory, navigation: { navigate: any } }) => {
    return (
        <View>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between'
                }}
            >
                <Text
                    style={{
                        fontSize: 16,
                        fontWeight: 'bold'
                    }}
                >{item.subCategoryName}</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('SubCategoryArticles', { subCategoryId: item.id })}
                >
                    <Text>See All</Text>
                </TouchableOpacity>

            </View>

            <FlatList
                keyExtractor={(item) => item.id.toString()}
                data={item.contents}
                renderItem={({ item }) => categoryArticle({ item, navigation })}
                numColumns={2}
                columnWrapperStyle={{
                    justifyContent: 'space-between',
                    gap: 10
                }}
                style={{
                    paddingTop: 5
                }}
            />
        </View>
    )
}

const categoryArticle = ({ item, navigation }: { item: IContent, navigation: { navigate: any } }) => {
    return (
        <View
            style={{
                width: (width - 60) / 2, // adjust for padding & gap
                marginBottom: 15,
            }}
        >
            <TouchableOpacity
                activeOpacity={0.4}
                style={{
                    borderRadius: 20,
                    overflow: 'hidden',
                }}
                onPress={() => navigation.navigate('ArticleDetails', { articleId: item.id })}
            >
                <ImageBackground
                    source={item.thumbnailImage}
                    resizeMode="cover"
                    style={{
                        height: 180,
                        width: '100%',
                        borderRadius: 20,
                        // overflow: 'hidden'
                        justifyContent: "flex-end",
                    }}>
                    <View style={{
                        ...StyleSheet.absoluteFillObject,
                        backgroundColor: "rgba(0,0,0,0.4)",
                    }} />
                    <Text style={{
                        color: colors.white,
                        paddingHorizontal: 15,
                        fontSize: 15,
                        paddingVertical: 4,
                    }}>{item.title}</Text>
                </ImageBackground>
            </TouchableOpacity>
        </View>
    )
}

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
                        renderItem={({ item }) => subCategoryItem({ item, navigation })}
                        scrollEnabled={false} // disable nested scroll
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
                            renderItem={({ item }) => categoryItem({ item, navigation })}
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