import React, { useEffect, useState } from 'react'
import { FlatList, View, Text } from 'react-native'
import ItemProduct from '../components/products/ItemProduct'
import SearchInput from '../components/SearchInput'
import { productData } from '../data/productsData'
import { globalStyles } from '../public/styles'
import { IProduct } from '../types/product.types'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../public/assets/colors'

export const FLProductItem = ({ item }: { item: IProduct }) => {
    return (
        <ItemProduct item={item} />
    )
}

const Products = () => {
    const [serachData, setSearchData] = useState("");
    const [getProductData, setProductData] = useState<IProduct[]>(productData);
    useEffect(() => {
        if (serachData.length > 0) {
            const filteredData = getProductData.filter((product: IProduct) => product.productName.toLowerCase().includes(serachData.toLowerCase()));
            setProductData(filteredData);
        } else {
            setProductData(productData);
        }
    }, [serachData])
    return (
        <SafeAreaView style={[globalStyles.container]}>
            <View>
                <SearchInput setSearchData={setSearchData} />
            </View>
            <FlatList
                data={getProductData}
                renderItem={FLProductItem}
                keyExtractor={(item, index) => index.toString()}
                numColumns={2}
                columnWrapperStyle={{ gap: 12, marginBottom: 20, justifyContent: 'space-between' }}
                ListFooterComponent={() => (
                    !getProductData.length && (
                        <View
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Text style={[{ color: colors.black }, globalStyles.fontRegular]}>No Products Found!</Text>
                        </View>
                    )
                )}
            />
        </SafeAreaView>
    )
}

export default Products