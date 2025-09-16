import { View, Text, ScrollView, Image } from 'react-native'
import React from 'react'
import { globalStyles } from '../public/styles'
import { productData } from '../data/productsData'

const Products = () => {
    return (
        <ScrollView style={[globalStyles.container]}>
            {
                productData.map((item, index) => (
                    <View key={index}>
                        {/* <Image source={require('../public/assets/images/viva_logo.png')} style={{ width: '100%', height: 200, marginBottom: 10, flex: 1 }} /> */}
                        <Image
                            source={require('../public/assets/images/viva_logo.png')}
                            style={{

                            }}
                        />
                        <Image
                            source={require('../public/assets/images/products/Product_8.png')}
                            style={{

                            }}
                        />
                        <Text>{item.productName}</Text>
                    </View>
                ))
            }
        </ScrollView>
    )
}

export default Products