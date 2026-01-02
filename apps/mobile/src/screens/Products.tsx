import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserProducts } from '../api/getUserProducts';
import ItemProduct from '../components/products/ItemProduct';
import SearchInput from '../components/SearchInput';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { IUserProduct, IUserProductResponse } from '../types/product.types';

const Products = () => {
    const navigation = useNavigation();
    const [searchData, setSearchData] = useState('');
    const [products, setProducts] = useState<IUserProduct[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Fetch once
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const response: IUserProductResponse = await getUserProducts();
                setProducts(response.data);
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setLoading(false);
            }
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
                renderItem={({ item }) => <ItemProduct item={item} navigation={navigation} />}
                keyExtractor={(item) => item._id}
                numColumns={2}
                columnWrapperStyle={{
                    gap: 15,
                    marginBottom: 15,
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
                        {loading ? (
                            <ActivityIndicator size="large" color={colors.purple} />
                        ) : (
                            <Text style={[{ color: colors.black }, globalStyles.fontRegular]}>
                                No Products Found!
                            </Text>
                        )}
                    </View>
                )}
            />
        </SafeAreaView>
    );
};

export default Products;
