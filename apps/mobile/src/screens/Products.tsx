import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserProducts } from '../api/getUserProducts';
import { useLanguage } from '../context/LanguageContext';
import ItemProduct from '../components/products/ItemProduct';
import SearchInput from '../components/SearchInput';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { IUserProduct, IUserProductResponse } from '../types/product.types';
import { AnalyticsEvent, recordError, track } from '../analytics';
import { useScreenEdges } from '../hooks/useScreenEdges';

const Products = () => {
    const { t } = useTranslation();
    // Registered both as a stack screen and as a tab; only the tab has a bar below it.
    const edges = useScreenEdges(true);
    const { language } = useLanguage();
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
                track(AnalyticsEvent.VIEW_ITEM_LIST, { item_list_name: 'products' });
            } catch (error) {
                console.error("Error fetching products:", error);
                recordError(error, 'Products.getUserProducts');
            } finally {
                setLoading(false);
            }
        })();
    }, [language]);

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
        <SafeAreaView style={globalStyles.container} edges={edges}>
            <View style={{ backgroundColor: colors.pageBG, padding: 10, paddingVertical: 8, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee' }}>
                <Text style={[globalStyles.fontRegular, { fontSize: 11, color: colors.darkGray, textAlign: 'center' }]}>
                    {t('products.amazonDisclaimer')}
                </Text>
            </View>
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
                                {t('products.noProductsFound')}
                            </Text>
                        )}
                    </View>
                )}
            />
        </SafeAreaView>
    );
};

export default Products;
