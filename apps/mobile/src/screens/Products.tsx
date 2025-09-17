import { View, Text, ScrollView, Image, FlatList, TextInput } from 'react-native'
import React from 'react'
import { globalStyles } from '../public/styles'
import { productData } from '../data/productsData'
import ItemProduct from '../components/products/ItemProduct'
import { IProduct } from '../types/product.types'
import { colors } from '../public/assets/colors'
import SearchInput from '../components/SearchInput'

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