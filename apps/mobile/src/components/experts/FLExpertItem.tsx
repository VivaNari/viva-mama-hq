import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { colors } from "../../public/assets/colors";
import { globalStyles } from "../../public/styles";
import { IExpert } from "../../types/expert.types";

const ExpertItem = ({ item, navigation }: { item: IExpert, navigation: { navigate: any } }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            style={styles.card}
            onPress={() => navigation.navigate('ExpertDetails', { expertId: item._id })}
        >
            {/* Expert Photo */}
            <View style={styles.imageContainer}>
                <Image
                    // source={require('../../public/assets/images/doctors/Dr_Anuradha_Kumari.png')}
                    source={{ uri: item.photograph }}
                    resizeMode="cover"
                    style={styles.image}
                />
                {/* Experience Badge */}
                <LinearGradient
                    colors={[colors.purple, colors.darkPurple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.experienceBadge}
                >
                    <Text style={[styles.experienceText, globalStyles.fontBold]}>
                        {item.yearsOfExperience}+ Years
                    </Text>
                </LinearGradient>
            </View>

            {/* Expert Info */}
            <View>
                {/* Name */}
                <Text style={[styles.name, globalStyles.fontSemiBold]}>
                    {item.name}
                </Text>
            </View>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 8,
        overflow: 'hidden',
        padding: 5,
        backgroundColor: colors.white,
        width: '48%',
        marginBottom: 10,
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        height: 180,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
    },
    image: {
        width: '100%',
        height: '100%',

    },
    experienceBadge: {
        position: 'absolute',
        top: 15,
        right: 15,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    experienceText: {
        color: colors.white,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    name: {
        fontSize: 14,
        color: '#1a1a1a',
        marginBottom: 8,
        textAlign: 'center',
        marginTop: 3
    },
    specialityBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.lightPurple,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 12,
    },
    speciality: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.purple,
    },
    qualificationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    qualificationLabel: {
        fontSize: 14,
        marginRight: 6,
    },
    qualification: {
        fontSize: 13,
        color: '#555',
        flex: 1,
        lineHeight: 18,
    },
    bio: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 16,
    },
    buttonContainer: {
        marginTop: 4,
    },
});

export default ExpertItem;