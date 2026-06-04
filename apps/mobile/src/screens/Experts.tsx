import React, { useEffect, useState } from 'react'
import { FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getExperts } from '../api/getExperts'
import VivaBuddyRequestCall from '../components/VivaBuddyRequestCall'
import { globalStyles } from '../public/styles'
import { colors } from '../public/assets/colors'
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

    return (
        <SafeAreaView
            style={[globalStyles.container,]}
        >
            {/* Experts List */}
            <FlatList
                keyExtractor={(item: IExpert) => item._id}
                data={experts}
                renderItem={({ item }) => ExpertItem({ item, navigation })}
                columnWrapperStyle={{
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    gap: 10,
                    marginBottom: 10
                }}
                // style={{}}
                numColumns={2}
                ListHeaderComponent={() => (
                    <View
                        style={{
                            marginBottom: 20
                        }}
                    >
                        <VivaBuddyRequestCall />
                        <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5, marginBottom: 15, textAlign: "center" }]}>
                            The Care Manager is a support coordinator, not a clinician. For medical questions, please consult a qualified healthcare professional.
                        </Text>

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
                                Connect with a healthcare professional
                            </Text>
                            <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5 }]}>
                                The consultation will be conducted by an independent healthcare professional. Any clinical advice, diagnosis, or treatment is provided by them, not by VivaMama. Please share relevant information clearly during the consultation.
                            </Text>
                        </View>
                    </View>
                )}
            />

        </SafeAreaView>
    )
}

export default Experts