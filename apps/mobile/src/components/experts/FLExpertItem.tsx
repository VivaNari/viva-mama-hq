import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../public/assets/colors";
import { globalStyles } from "../../public/styles";
import { IExpert } from "../../types/expert.types";

const ExpertItem = ({ item, navigation }: { item: IExpert, navigation: { navigate: any } }) => {
    return (
        <View
            style={{
                padding: 2,
                width: '50%',
                flexShrink: 1
            }}
        >
            <TouchableOpacity
                activeOpacity={0.85}
                style={{
                    justifyContent: 'flex-start',
                    flex: 1,
                    width: '100%',
                    borderRadius: 6,
                    overflow: 'hidden',
                    boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                }}
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
                </View>

                {/* Expert Info */}
                <View style={{ paddingVertical: 0 }}>
                    {/* Name */}
                    <Text style={[styles.name, globalStyles.fontSemiBold]}>
                        {item.name}
                    </Text>
                    <Text style={[styles.speciality, globalStyles.fontSemiBold]}>
                        {item.speciality}
                    </Text>
                </View>
                <View
                    style={styles.experienceBadge}
                >
                    <Text style={[styles.experienceText, globalStyles.fontBold]}>
                        {item.yearsOfExperience}+ Years
                    </Text>
                </View>
            </TouchableOpacity>
        </View>
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
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 20,
        color: colors.lightPurple,
        borderWidth: 1,
        borderColor: colors.darkPurple,
        alignContent: "center",
        backgroundColor: colors.lightPurple,
        width: 75,
        marginLeft: 10,
        marginTop: 10,
        marginBottom: 10
    },
    experienceText: {
        color: colors.purple,
        fontSize: 12
    },
    name: {
        fontSize: 16,
        color: '#1a1a1a',
        marginTop: 5,
        marginLeft: 10
    },
    specialityBadge: {
        alignSelf: 'center',
        alignContent: "center",
        backgroundColor: colors.lightPurple,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 12,
        marginTop: 10,
    },
    speciality: {
        fontSize: 13,
        marginTop: 0,
        fontWeight: '600',
        color: colors.purple,
        marginLeft: 10,
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