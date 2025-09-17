import React from 'react'
import { FlatList, View } from 'react-native'
import ItemProduct from '../components/products/ItemProduct'
import SearchInput from '../components/SearchInput'
import { productData } from '../data/productsData'
import { globalStyles } from '../public/styles'
import { IProduct } from '../types/product.types'

const renderFlatlistItem = ({ item }: { item: IProduct }) => {
    console.log("item is ", item)
    return (
        <ItemProduct item={item} />
    )
}

const Products = () => {
    return (
        <View style={[globalStyles.container]}>
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
        </View>
    )
}

export default Products