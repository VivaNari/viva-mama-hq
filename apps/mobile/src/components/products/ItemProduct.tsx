import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { globalStyles } from '../../public/styles';
import { IUserProduct } from '../../types/product.types';

const ItemProduct = ({ item, navigation }: { item: IUserProduct, navigation: any }) => {
    return (
        <View
            style={{
                padding: 2,
                width: '50%',
                flexShrink: 1
            }}
        >

            <TouchableOpacity
                onPress={() => navigation.navigate("ProductDetails", { productId: item._id })}
                activeOpacity={0.8}
                style={[{
                    justifyContent: 'flex-start',
                    flex: 1,
                    width: '100%',
                    borderRadius: 6,
                    overflow: 'hidden',
                    boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',

                }]}>
                <Image
                    source={{ uri: item.productImageURL }}
                    style={{ width: "100%", height: 160, borderRadius: 8 }}
                />

                <Text
                    style={[{
                        marginVertical: 8,
                        marginHorizontal: 5,
                        textAlign: "center",
                        fontSize: 16
                    }, globalStyles.fontRegular]}
                >{item.productName}</Text>
            </TouchableOpacity>
        </View>
    )
}

export default ItemProduct