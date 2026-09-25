import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart } from 'react-native-gifted-charts'
import { View, Text, Dimensions } from 'react-native'
import { colors } from '../../public/assets/colors'
import { globalStyles } from '../../public/styles'
import { checkinHistory } from '../../api/checkinHistory'
import { ICheckInHistory, ICheckInHistoryResponse } from '../../types/dashboard.types'

// LineChart renders its OWN horizontal ScrollView. Wrapping it in another one meant two
// nested horizontal scrollers: the inner captured every pan gesture, and because `width`
// was set to the full content width it had nothing to scroll — so neither moved and the
// graph was frozen. The chart scrolls itself once `width` is the VISIBLE width and the
// data is wider than that. It also keeps the y-axis pinned outside the scrolling area,
// which the outer ScrollView used to drag off-screen along with the plot.
const SHEET_HORIZONTAL_PADDING = 20 // AppBottomSheet's BottomSheetView padding
const Y_AXIS_LABEL_WIDTH = 40
const POINT_SPACING = 60

const PLOT_WIDTH =
    Dimensions.get('window').width - SHEET_HORIZONTAL_PADDING * 2 - Y_AXIS_LABEL_WIDTH

const RecoveryProgressGraph = () => {
    const { t } = useTranslation();
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

    const hasData = data.length > 0

    return (
        <View style={{ paddingVertical: 10 }}>
            <Text
                style={[{
                    fontSize: 16,
                    textAlign: 'center',
                    marginBottom: 30

                }, globalStyles.fontBold]}
            >
                {t('vivaScore.progressTitle')}

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
                        {t('common.loading')}
                    </Text>
                ) : !hasData ? (
                    <Text
                        style={[{
                            fontSize: 14,
                            textAlign: 'center',
                            color: colors.gray,
                            marginBottom: 30,
                        }, globalStyles.fontRegular]}
                    >
                        {t('vivaScore.noProgressYet')}
                    </Text>
                ) : (
                    <View style={{ paddingBottom: 10 }}>
                        <LineChart
                            data={data}
                            maxValue={100}

                            // The VISIBLE plot width, not the content width. The chart
                            // scrolls itself when the data is wider than this.
                            width={PLOT_WIDTH}
                            spacing={POINT_SPACING}
                            initialSpacing={20}
                            endSpacing={20}

                            // Open on the most recent weeks — by week 40 the interesting
                            // end of a 52-point series is the right-hand one.
                            scrollToEnd
                            scrollAnimation={false}
                            showScrollIndicator

                            color={'#ef86a3'}
                            thickness={4}
                            dataPointsColor={colors.darkPurple}
                            yAxisColor={colors.gray}
                            xAxisColor={colors.gray}

                            yAxisTextStyle={{ color: colors.darkGray, ...globalStyles.fontRegular }}
                            yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                            xAxisLabelTextStyle={{ color: colors.darkGray, ...globalStyles.fontRegular }}

                            curved
                        />
                    </View>
                )
            }
        </View>
    )
}

export default RecoveryProgressGraph
