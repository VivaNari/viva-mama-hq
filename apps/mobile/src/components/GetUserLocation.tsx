import React, { useEffect, useState } from 'react'
import { ActivityIndicator, PermissionsAndroid, Text, ToastAndroid, TouchableOpacity } from 'react-native'
import { styles as chatStyles } from '../public/styles/chatWithVivaAiStyles'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import Geolocation from 'react-native-geolocation-service';
import { IUserLocation } from '../types/vivaAi.types'

const GetUserLocation = () => {
    const requestLocationPermission = async () => {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: 'Geolocation Permission',
                    message: 'Can we access your location?',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                },
            );
            if (granted === 'granted') {
                console.log('You can use Geolocation');
                return true;
            } else {
                console.log('You cannot use Geolocation');
                return false;
            }
        } catch (err) {
            return false;
        }
    };
    const [location, setLocation] = useState<IUserLocation | null>();
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        // need to get the location name calling a google api from latitude and longitude
        
    }, [location]);

    const getLocation = () => {
        setLoading(true);
        const result = requestLocationPermission();
        result.then(res => {
            console.log('res is:', res);
            if (res) {
                Geolocation.getCurrentPosition(
                    (position) => {
                        console.log(position);
                        setLocation({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        });
                    },
                    error => {
                        console.log(error.code, error.message);
                        ToastAndroid.show(error.message, ToastAndroid.SHORT)
                        setLocation(null);
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
                );
            }
        });
        setLoading(false);
    };

    return (
        <TouchableOpacity
            style={[chatStyles.textInput, { flex: 1, gap: 5, flexDirection: 'row', alignItems: 'center' }]}
            onPress={getLocation}
            disabled={loading}
        >
            {
                loading && <ActivityIndicator size={20} />
            }
            <Text style={[{ color: colors.black, textAlign: 'center' }, globalStyles.fontRegular]}>
                {
                    location ? `Location: (${location.latitude}, ${location.longitude})` : 'Send Current Location'
                }

            </Text>
        </TouchableOpacity>
    )
}

export default GetUserLocation
