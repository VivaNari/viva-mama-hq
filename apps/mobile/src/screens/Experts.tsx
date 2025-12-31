import React, { useEffect, useState } from 'react'
import { FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getExperts } from '../api/getExperts'
import VivaBuddyRequestCall from '../components/VivaBuddyRequestCall'
import { globalStyles } from '../public/styles'
import { IExpert, IExpertResponse } from '../types/expert.types'
import ExpertItem from '../components/experts/FLExpertItem'

const Experts = ({ navigation }: { navigation: { navigate: any } }) => {
    const [experts, setExperts] = useState<IExpert[]>([]);

    useEffect(() => {
        (async () => {
            const response: IExpertResponse = await getExperts();
            setExperts(response.data);
        })();
    }, []);

    useEffect(() => {
        console.log("experts are =??", experts);
    }, [experts]);
    return (
        <SafeAreaView
            style={[globalStyles.container,]}
        >
            {/* Experts List */}
            <FlatList
                keyExtractor={(item: IExpert) => item._id}
                data={experts}
                renderItem={({ item }) => ExpertItem({ item, navigation })}
                // style={{}}
                ListHeaderComponent={() => (
                    <View
                        style={{
                            marginBottom: 20
                        }}
                    >
                        <VivaBuddyRequestCall />

                        <View
                            style={{
                                marginTop: 25
                            }}
                        >
                            <Text
                                style={[{
                                    fontSize: 20,
                                    fontWeight: '600',
                                }, globalStyles.fontBold]}
                            >
                                Consult the doctor
                            </Text>
                        </View>
                    </View>
                )}
            />

        </SafeAreaView>
    )
}

export default Experts