import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { IExpert } from "../../types/expert.types"
import { colors } from "../../public/assets/colors";
import { globalStyles } from "../../public/styles";
import GradientButtonWithSlightRadius from "../GradientButtonWithSlightRadius";
import LinearGradient from "react-native-linear-gradient";

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
            <View style={styles.infoContainer}>
                {/* Name */}
                <Text style={[styles.name, globalStyles.fontBold]} numberOfLines={1}>
                    {item.name}
                </Text>

                {/* Speciality Badge */}
                <View style={styles.specialityBadge}>
                    <Text style={[styles.speciality, globalStyles.fontSemiBold]} numberOfLines={1}>
                        {item.speciality}
                    </Text>
                </View>

                {/* Qualification */}
                <View style={styles.qualificationContainer}>
                    <Text style={[styles.qualificationLabel, globalStyles.fontMedium]}>
                        🎓
                    </Text>
                    <Text style={[styles.qualification, globalStyles.fontRegular]} numberOfLines={1}>
                        {item.qualification}
                    </Text>
                </View>

                {/* Bio */}
                <Text style={[styles.bio, globalStyles.fontRegular]} numberOfLines={3}>
                    {item.bio}
                </Text>

                {/* Book Now Button */}
                <View style={styles.buttonContainer}>
                    <GradientButtonWithSlightRadius
                        onPress={() => navigation.navigate('ExpertDetails', { expertId: item._id })}
                        title="Book Consultation"
                    />
                </View>
            </View>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: 20,
        marginHorizontal: 2,
        marginBottom: 20,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        height: 240,
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
    infoContainer: {
        padding: 18,
    },
    name: {
        fontSize: 18,
        color: '#1a1a1a',
        marginBottom: 8,
        ...globalStyles.fontRegular
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