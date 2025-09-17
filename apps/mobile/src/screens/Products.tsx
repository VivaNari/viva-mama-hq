import React from 'react'
import { FlatList, View } from 'react-native'
import ItemProduct from '../components/products/ItemProduct'
import SearchInput from '../components/SearchInput'
import { productData } from '../data/productsData'
import { globalStyles } from '../public/styles'
import { IProduct } from '../types/product.types'
import { SafeAreaView } from 'react-native-safe-area-context'

const renderFlatlistItem = ({ item }: { item: IProduct }) => {
    console.log("item is ", item)
    return (
        <ItemProduct item={item} />
    )
}

const Products = () => {
    return (
        <SafeAreaView style={[globalStyles.container]}>
            <View>
                <SearchInput />
            </View>
            <FlatList
                data={productData}
                renderItem={renderFlatlistItem}
                keyExtractor={(item, index) => index.toString()}
                numColumns={2}
                columnWrapperStyle={{ gap: 12, marginBottom: 20 }}
            />
        </SafeAreaView>
    )
}

export default Products