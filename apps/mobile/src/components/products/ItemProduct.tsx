import { View, Text, Image, Dimensions, TouchableOpacity, Linking } from 'react-native'
import React from 'react'
import { IProduct } from '../../types/product.types'
import { globalStyles } from '../../public/styles';

const { width } = Dimensions.get('window');

const ItemProduct = ({ item }: { item: IProduct }) => {
    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(item.productURL)}
            activeOpacity={0.8}
            style={[{
                justifyContent: 'flex-start',
                flex: 1,
                maxWidth: (width - 55) / 2,
            }]}>
            <Image
                source={item.productImage}
                style={{ width: "100%", borderRadius: 8 }}
            />

            <Text
                style={[{
                    marginVertical: 3
                }, globalStyles.fontRegular]}
            >{item.productName}</Text>
        </TouchableOpacity>
    )
}

export default ItemProduct