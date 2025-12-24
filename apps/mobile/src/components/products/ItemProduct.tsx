import React from 'react';
import { Dimensions, Image, Linking, Text, TouchableOpacity } from 'react-native';
import { globalStyles } from '../../public/styles';
import { IUserProduct } from '../../types/product.types';

const { width } = Dimensions.get('window');

const ItemProduct = ({ item }: { item: IUserProduct }) => {
    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(item.productAffiliateLink)}
            activeOpacity={0.8}
            style={[{
                justifyContent: 'flex-start',
                flex: 1,
                maxWidth: (width - 55) / 2,
            }]}>
            <Image
                source={{ uri: item.productImageURL }}
                style={{ width: "100%", height: 160, borderRadius: 8 }}
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