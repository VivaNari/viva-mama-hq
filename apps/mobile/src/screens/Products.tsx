import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserProducts } from '../api/getUserProducts';
import ItemProduct from '../components/products/ItemProduct';
import SearchInput from '../components/SearchInput';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { IUserProduct, IUserProductResponse } from '../types/product.types';

export const FLProductItem = ({ item }: { item: IUserProduct }) => {
    return <ItemProduct item={item} />;
};

const Products = () => {
    const [searchData, setSearchData] = useState('');
    const [products, setProducts] = useState<IUserProduct[]>([]);

    // Fetch once
    useEffect(() => {
        (async () => {
            const response: IUserProductResponse = await getUserProducts();
            setProducts(response.data);
        })();
    }, []);

    // Derived filtered list
    const filteredProducts = useMemo(() => {
        if (!searchData.trim()) return products;

        return products.filter(product =>
            product.productName
                .toLowerCase()
                .includes(searchData.toLowerCase())
        );
    }, [searchData, products]);

    return (
        <SafeAreaView style={globalStyles.container}>
            <View>
                <SearchInput setSearchData={setSearchData} />
            </View>

            <FlatList
                data={filteredProducts}
                renderItem={FLProductItem}
                keyExtractor={(item) => item._id}
                numColumns={2}
                columnWrapperStyle={{
                    gap: 12,
                    marginBottom: 20,
                    justifyContent: 'space-between',
                }}
                ListEmptyComponent={() => (
                    <View
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 40,
                        }}
                    >
                        <Text style={[{ color: colors.black }, globalStyles.fontRegular]}>
                            No Products Found!
                        </Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
};

export default Products;
