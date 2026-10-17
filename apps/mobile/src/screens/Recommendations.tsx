import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FLItemRecommendation from '../components/recommendations/FLItemRecommendation';
import { recommendationsData } from '../data/recommendationsData';
import { globalStyles } from '../public/styles';

const Recommendations = () => {

    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();


    return (
        <View style={globalStyles.container}>
            <FlatList
                data={recommendationsData}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => FLItemRecommendation({ item, navigation })}
                // The navigator header covers the top inset; the bottom is on us, or the
                // last card sits under the gesture bar once edge-to-edge is enforced.
                contentContainerStyle={{ paddingBottom: insets.bottom }}
            />
        </View>
    )
}

export default Recommendations