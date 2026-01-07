import React from 'react'
import { Text, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { ConsultationTypeEnum, IUserActiveConsultations } from '../types/consultation.types'
import { convertDateToIST } from '../utils/convertDateToIST'

const ActiveConsultation = ({ item }: { item: IUserActiveConsultations }) => {
    return (
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <LinearGradient
                colors={[colors.purple, colors.darkPurple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                    borderRadius: 10,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 15,
                    flex: 1,
                    marginBottom: 0,
                    gap: 15
                }}
            >
                <Text
                    style={[
                        {
                            fontSize: 16,
                            flexShrink: 1,
                            color: colors.white,
                        },
                        globalStyles.fontSemiBold
                    ]}
                >
                    You have an upcoming consultation with {item.consultationType === ConsultationTypeEnum.CARE_MANAGER ? "Care Manager" : "Expert"}: {item.consultatorId.name}, initiated at {convertDateToIST(item.createdAt)}

                </Text>
            </LinearGradient>
        </View>
    )
}

export default ActiveConsultation