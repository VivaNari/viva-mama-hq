import { View, Text, ScrollView, Image, FlatList, SectionList, StyleSheet } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { globalStyles } from '../public/styles'
import { fullReportData } from '../data/fullReportData'
import VivaScoreGauge from '../components/VivaScoreGauge'
import { colors } from '../public/assets/colors'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import { useNavigation } from '@react-navigation/native'

const FullReport = () => {
    const navigation = useNavigation<any>();
    return (
        <SafeAreaView
            style={[globalStyles.container]}
        >
            <ScrollView>
                <View>
                    <View>
                        <Text
                            style=
                            {[globalStyles.fontMedium, {
                                fontSize: 20,
                                paddingBottom: 5,
                                borderBottomWidth: 1,
                                borderBottomColor: 'rgba(0, 0, 0, 0.2)',
                            }]}
                        >
                            Week {fullReportData.weekNumber}
                        </Text>

                        <Text
                            style={[globalStyles.fontRegular, {
                                fontSize: 12,
                                paddingVertical: 10
                            }]}
                        >
                            {fullReportData.description}
                        </Text>
                    </View>

                    {/* Viva Recovery Score */}
                    <View
                    >
                        <View
                            style={{
                                borderWidth: 2,
                                borderColor: 'rgba(0, 0, 0, 0.06)',
                                padding: 10,
                                borderRadius: 20,
                                marginTop: 25
                            }}
                        >
                            <Text
                                style={[{
                                    fontSize: 16,

                                }, globalStyles.fontBold]}
                            >
                                Viva Recovery Score
                            </Text>
                            <Text
                                style={[{
                                    fontSize: 10,

                                }, globalStyles.fontRegular]}
                            >
                                Based on the weekly check-in
                            </Text>
                            <VivaScoreGauge percentage={fullReportData.vivaRecoveryScroreInPercentage} />
                        </View>

                        {/* BMI */}
                        <View
                            style={{
                                marginVertical: 20,
                            }}
                        >
                            <Text
                                style={[{
                                    fontSize: 16,

                                }, globalStyles.fontBold]}
                            >
                                BMI - Body Mass Index
                            </Text>

                            <View
                                style={[, {
                                    marginTop: 10,
                                    backgroundColor:
                                        fullReportData.bmi.type == 'normal' ? colors.success :
                                            fullReportData.bmi.type == 'warning' ? colors.warning : colors.error,
                                    padding: 10,
                                    borderRadius: 10
                                }]}
                            >
                                <Text
                                    style={[{
                                        fontSize: 20
                                    }, globalStyles.fontSemiBold]}
                                >
                                    {fullReportData.bmi.value}
                                </Text>
                                <Text
                                    style={[{
                                        fontSize: 12
                                    }, globalStyles.fontRegular]}
                                >
                                    {fullReportData.bmi.category}
                                </Text>
                            </View>
                        </View>

                        {/* Note */}
                        <Text
                            style={[{
                                fontSize: 12
                            }, globalStyles.fontRegular]}
                        >
                            {fullReportData.note}
                        </Text>
                        <View
                            style={{
                                marginVertical: 15
                            }}
                        >

                            <Image
                                source={fullReportData.activityImage}
                                resizeMode="contain"
                                style={{
                                    height: 200,
                                    width: '100%',
                                }}
                            />
                        </View>

                        {/* Recovery */}
                        <View>
                            <Text
                                style={[{
                                    fontSize: 20,

                                }, globalStyles.fontBold]}
                            >
                                Week {fullReportData.weekNumber} {fullReportData.recoveryState}
                            </Text>

                            <SectionList
                                scrollEnabled={false}
                                sections={fullReportData.recoveryDescription.map((item) => ({
                                    title: item.section,
                                    data: item.data,
                                    type: item.dataType
                                }))}
                                keyExtractor={(item, index) => item + index}
                                renderItem={({ item, section }) => (
                                    <View style={{ marginBottom: 6 }}>
                                        <Text style={[{
                                            fontSize: 12,
                                            color: "#555",
                                            lineHeight: 20,
                                        }, globalStyles.fontRegular]}>
                                            {section.type == "list" && "• "}{item}
                                        </Text>
                                    </View>
                                )}
                                renderSectionHeader={({ section: { title } }) => (
                                    <Text
                                        style={[{
                                            fontSize: 16,
                                            marginTop: 16,
                                            marginBottom: 8,
                                            color: "#333",
                                        }, globalStyles.fontBold]}
                                    >
                                        {title}
                                    </Text>
                                )}
                                contentContainerStyle={{
                                    marginTop: 15
                                }}
                            />
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View
                style={{ flexDirection: 'row' }}
            >
                <GradientButtonWithSlightRadius
                    title='Ask Viva AI for more details'
                    fullRounded={true}
                    onPress={() => { navigation.navigate("ChatWithVivaAI") }}
                />
            </View>
        </SafeAreaView>
    )
}

export default FullReport
