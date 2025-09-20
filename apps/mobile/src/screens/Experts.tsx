import React from 'react'
import { FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import VivaBuddyRequestCall from '../components/VivaBuddyRequestCall'
import { expertData } from '../data/expertData'
import { globalStyles } from '../public/styles'
import { IExpertCategory } from '../types/expert.types'
import ExpertCategoryItem from '../components/experts/FLExpertCategoryItem'

const Experts = ({ navigation }: { navigation: { navigate: any } }) => {
    return (
        <SafeAreaView
            style={[globalStyles.container,]}
        >
            {/* Experts List */}
            <FlatList
                keyExtractor={(item: IExpertCategory) => item.id.toString()}
                data={expertData}
                renderItem={({ item }) => ExpertCategoryItem({ item, navigation })}
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