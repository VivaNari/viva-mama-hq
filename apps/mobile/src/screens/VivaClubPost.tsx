import { useNavigation } from '@react-navigation/native'
import React from 'react'
import { FlatList, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import FLVivaClubPostItem from '../components/vivaClub/FLVivaClubPostItem'
import { vivaClubData } from '../data/vivaClubData'
import { globalStyles } from '../public/styles'
import LinearGradient from 'react-native-linear-gradient'
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons'
import { colors } from '../public/assets/colors'

const VivaClubPost = () => {
    const navigation = useNavigation<any>();
    return (
        <SafeAreaView
            style={[globalStyles.container, { position: 'relative', paddingVertical: 5 }]}
        >
            <FlatList
                keyExtractor={(item) => item.id.toString()}
                data={vivaClubData}
                renderItem={({ item }) => FLVivaClubPostItem({ item, navigation })}
                scrollEnabled
                showsVerticalScrollIndicator={false}
            />

            <LinearGradient
                onTouchEnd={() => navigation.navigate("CreatePost")}
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                onMagicTap={() => { }}
                style={{
                    borderRadius: 40,
                    height: 70,
                    width: 70,
                    padding: 2,
                    justifyContent: "center",
                    alignItems: "center",
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                }}
            >
                <MaterialDesignIcons name='pencil-box-outline' color={colors.white} size={22} />
                <Text
                    style={[{
                        fontSize: 10,
                        textAlign: 'center',
                        color: colors.white,
                    }, globalStyles.fontRegular]}
                >
                    Create
                </Text>
            </LinearGradient>
        </SafeAreaView>
    )
}

export default VivaClubPost