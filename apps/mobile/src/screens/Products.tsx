import React from 'react'
import { FlatList, View } from 'react-native'
import ItemProduct from '../components/products/ItemProduct'
import SearchInput from '../components/SearchInput'
import { productData } from '../data/productsData'
import { globalStyles } from '../public/styles'
import { IProduct } from '../types/product.types'
import { SafeAreaView } from 'react-native-safe-area-context'

export const renderFlatlistItem = ({ item }: { item: IProduct }) => {
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
                columnWrapperStyle={{ gap: 12, marginBottom: 20, justifyContent: 'space-between' }}
            />
        </SafeAreaView>
    )
}

export default Products