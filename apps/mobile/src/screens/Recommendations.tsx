import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { FlatList, View } from 'react-native';
import FLItemRecommendation from '../components/recommendations/FLItemRecommendation';
import { recommendationsData } from '../data/recommendationsData';
import { globalStyles } from '../public/styles';

const Recommendations = () => {

    const navigation = useNavigation<any>();


    return (
        <View style={globalStyles.container}>
            <FlatList
                data={recommendationsData}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => FLItemRecommendation({ item, navigation })}
            />
        </View>
    )
}

export default Recommendations