import { View, Text, Image, TextInput } from 'react-native'
import React, { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { globalStyles } from '../public/styles'
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import { useNavigation } from '@react-navigation/native'

const CreatePost = () => {
    const [postText, setPostText] = useState<string>("")
    const navigation = useNavigation<any>();
    return (
        <SafeAreaView
            style={globalStyles.container}
        >
            <View>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',

                    }}
                >
                    <MaterialDesignIcons
                        onPress={() => navigation.goBack()}
                        name='eyedropper-remove'
                        size={20}
                    />
                    <GradientButtonWithSlightRadius
                        fullRounded={true}
                        title='Post'
                        onPress={() => { }}
                        fullWidth={false}
                    />
                </View>

                <View>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 10,
                            marginTop: 30
                        }}
                    >
                        <Image
                            source={require("../public/assets/images/doctors/Dr_Harsha_Tomar.png")}
                            style={{
                                height: 30,
                                width: 30,
                                borderRadius: 30,
                                objectFit: 'cover'
                            }}
                        />
                        <View
                            style={{ flex: 1 }}
                        >
                            <Text
                                style={[{
                                    fontSize: 10,
                                    color: 'rgba(0, 0, 0, 0.47)'

                                }, globalStyles.fontMedium]}
                            >
                                {postText.length.toString()}/250
                            </Text>
                            <TextInput
                                style={[{
                                    fontSize: 12,
                                    color: 'rgba(0, 0, 0, 0.47)',
                                    // padding: 20
                                }, globalStyles.fontMedium]}
                                placeholder='Share your Thoughts...'
                                placeholderTextColor={'rgba(0, 0, 0, 0.47)'}
                                multiline={true}
                                value={postText}
                                maxLength={250}
                                onChangeText={(text) => setPostText(text)}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    )
}

export default CreatePost