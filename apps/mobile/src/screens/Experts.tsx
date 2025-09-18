import { View, Text, FlatList, Image, Dimensions, TouchableOpacity, ImageBackground, StyleSheet } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { globalStyles } from '../public/styles'
import VivaBuddyRequestCall from '../components/VivaBuddyRequestCall'
import { expertData } from '../data/expertData'
import { IExpert, IExpertCategory } from '../types/expert.types'
import { colors } from '../public/assets/colors'
import LinearGradient from 'react-native-linear-gradient'

const { width } = Dimensions.get("window");

const ExpertItem = ({ item, navigation, category }: { item: IExpert, category: string, navigation: { navigate: any } }) => {
    return (
        <View
            style={{
                width: (width - 60) / 2,
                marginBottom: 15,
            }}
        >
            <TouchableOpacity
                activeOpacity={0.8}
                style={{
                    borderRadius: 15,
                    overflow: 'hidden',
                    padding: 10,
                    backgroundColor: colors.white
                }}
                onPress={() => navigation.navigate('ExpertDetails', { expertId: item.id, category: category })}
            >
                <Image
                    source={item.avatar}
                    resizeMode="cover"
                    style={{
                        height: 180,
                        width: '100%',
                        borderRadius: 15,
                        justifyContent: "flex-end",
                    }}
                />
                <Text
                    style={{
                        fontSize: 16,
                        fontWeight: '500',
                        marginTop: 10,
                        textAlign: 'center',
                    }}
                >
                    {item.name}
                </Text>
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: '500',
                        textAlign: 'center',
                    }}
                >
                    {item.remuneration}
                </Text>


                <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        borderRadius: 10,
                        justifyContent: "center",
                        alignItems: "center",
                        paddingVertical: 10,
                        marginTop: 10
                    }}
                >
                    <Text
                        style={{
                            color: colors.white
                        }}
                    >Book Now</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    )
}

const ExpertCategoryItem = ({ item, navigation }: { item: IExpertCategory, navigation: { navigate: any } }) => {
    const category = item.category;
    return (
        <View
            style={{
                paddingTop: 25
            }}
        >
            <Text
                style={{
                    fontSize: 18,
                    fontWeight: '600',
                    marginBottom: 10,
                }}
            >
                {item.category}
            </Text>

            {/* Doctors List */}
            <FlatList
                keyExtractor={(doctor) => doctor.id.toString()}
                data={item.experts}
                renderItem={({ item }) => ExpertItem({ item, navigation, category: category })}
                numColumns={2}
                columnWrapperStyle={{
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                }}
            />
        </View>
    )
}

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
                style={{}}
                ListHeaderComponent={() => (
                    <View>
                        <VivaBuddyRequestCall />

                        <View
                            style={{
                                marginTop: 20
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 22,
                                    fontWeight: '600',
                                }}
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