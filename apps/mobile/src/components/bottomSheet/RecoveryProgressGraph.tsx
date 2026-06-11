import React, { useEffect, useState } from 'react'
import { LineChart } from 'react-native-gifted-charts'
import { View, ScrollView, Text } from 'react-native'
import { colors } from '../../public/assets/colors'
import { globalStyles } from '../../public/styles'
import { checkinHistory } from '../../api/checkinHistory'
import { ICheckInHistory, ICheckInHistoryResponse } from '../../types/dashboard.types'

const RecoveryProgressGraph = () => {
    const [loading, setLoading] = useState<boolean>(false)
    const [recoveryData, setRecoveryData] = useState<ICheckInHistory[]>([])
    useEffect(() => {
        getScoreHistory();
    }, [])

    const getScoreHistory = async () => {
        setLoading(true)

        const getRecoveryData: ICheckInHistoryResponse = await checkinHistory();
        setRecoveryData(getRecoveryData.data);
        setLoading(false);
    }

    const data = recoveryData.map(item => ({
        value: item.finalScore,
        label: `W${item.week}`,
    }))

    const spacing = 60
    const chartWidth = data.length * spacing + 0

    return (
        <View style={{ paddingVertical: 10 }}>
            <Text
                style={[{
                    fontSize: 16,
                    textAlign: 'center',
                    marginBottom: 30

                }, globalStyles.fontBold]}
            >
                Check your Recovery Progress

            </Text>
            {
                loading ? (
                    <Text
                        style={[{
                            fontSize: 14,
                            textAlign: 'center',
                            marginBottom: 30

                        }, globalStyles.fontRegular]}
                    >
                        Loading...
                    </Text>
                ) : (

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        nestedScrollEnabled
                    >
                        <View style={{ paddingBottom: 10 }}>

                            <LineChart
                                data={data}
                                maxValue={100}

                                width={chartWidth}
                                spacing={spacing}
                                initialSpacing={20}

                                color={'#ef86a3'}
                                thickness={4}
                                dataPointsColor={colors.darkPurple}
                                yAxisColor={colors.gray}
                                xAxisColor={colors.gray}

                                yAxisTextStyle={{ color: colors.darkGray, ...globalStyles.fontRegular }}
                                yAxisLabelWidth={40}
                                xAxisLabelTextStyle={{ color: colors.darkGray, ...globalStyles.fontRegular }}

                                curved
                            // areaChart
                            />
                        </View>
                    </ScrollView>
                )
            }
        </View>
    )
}

export default RecoveryProgressGraph
