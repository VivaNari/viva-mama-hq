import { View, Text, Image, TextInput } from 'react-native'
import React, { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { globalStyles } from '../public/styles'
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import { useNavigation } from '@react-navigation/native'
import apiClientInterceptor from '../api/apiClientInterceptor'
import { API_VIVA_CLUB_CREATE_POST } from '../constants/endpoints'
import Toast from 'react-native-toast-message'

const CreatePost = () => {
    const [postText, setPostText] = useState<string>("")
    const [loading, setLoading] = useState<boolean>(false)
    const navigation = useNavigation<any>();

    const handlePost = async () => {
        if (!postText.trim()) return;

        try {
            setLoading(true);
            await apiClientInterceptor().post(API_VIVA_CLUB_CREATE_POST, {
                content: postText,
                mediaUrls: []
            });
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Post published successfully!'
            });
            navigation.navigate("VivaClub");
        } catch (error) {
            console.error("Failed to create post", error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to publish post'
            });
        } finally {
            setLoading(false);
        }
    }

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
                        name='close'
                        size={24}
                    />
                    <GradientButtonWithSlightRadius
                        fullRounded={true}
                        title={loading ? 'Posting...' : 'Post'}
                        onPress={handlePost}
                        fullWidth={false}
                        disabled={loading || !postText.trim()}
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
                            source={require("../public/assets/images/avatar_ai.jpg")}
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