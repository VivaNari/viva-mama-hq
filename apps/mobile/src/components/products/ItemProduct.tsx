import { View, Text, Image } from 'react-native'
import React from 'react'
import { IProduct } from '../../types/product.types'

const ItemProduct = ({ item }: { item: IProduct }) => {
    return (
        <View style={{ justifyContent: 'space-between', flex: 1 }}>
            <Image
                source={item.productImage}
                style={{ width: "100%", borderRadius: 8 }}
            />

            <Text
                style={{ margin: 2 }}
            >{item.productName}</Text>
        </View>
    )
}

export default ItemProduct