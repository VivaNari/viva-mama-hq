import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

const AboutVivaMama = () => {
    const { t } = useTranslation();
    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <LinearGradient
                    colors={[colors.darkPurple, colors.purple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroSection}
                >
                    <View style={styles.logoContainer}>
                        <Image
                            source={require("../public/assets/images/viva_logo.png")}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={[styles.heroTitle, globalStyles.fontBold]}>{t('about.ourStory')}</Text>
                    <View style={styles.heroOverlay} />
                </LinearGradient>

                {/* Content Container */}
                <View style={styles.contentContainer}>
                    {/* Mission Section */}
                    <View style={styles.sectionCard}>
                        <View style={styles.iconCircle}>
                            <Lucide name="heart" size={24} color={colors.purple} />
                        </View>
                        <Text style={[styles.sectionTitle, globalStyles.fontBold]}>{t('about.ourMission')}</Text>
                        <Text style={[styles.sectionText, globalStyles.fontRegular]}>
                            {t('about.missionText')}
                        </Text>
                    </View>

                    {/* Trust Section */}
                    <View style={styles.sectionCard}>
                        <View style={styles.iconCircle}>
                            <Lucide name="shield-check" size={24} color={colors.purple} />
                        </View>
                        <Text style={[styles.sectionTitle, globalStyles.fontBold]}>{t('about.trustedPrivate')}</Text>
                        <Text style={[styles.sectionText, globalStyles.fontRegular]}>
                            {t('about.trustText')}
                        </Text>
                    </View>

                    {/* Origins Section */}
                    <View style={styles.sectionCard}>
                        <View style={styles.iconCircle}>
                            <Lucide name="sparkles" size={24} color={colors.purple} />
                        </View>
                        <Text style={[styles.sectionTitle, globalStyles.fontBold]}>{t('about.builtByMoms')}</Text>
                        <Text style={[styles.sectionText, globalStyles.fontRegular]}>
                            {t('about.originsText')}
                        </Text>
                    </View>

                    {/* Footer Info */}
                    <View style={styles.footer}>
                        <Text style={[styles.versionText, globalStyles.fontRegular]}>{t('about.version')}</Text>
                        <Text style={[styles.copyrightText, globalStyles.fontRegular]}>{t('about.copyright', { year: new Date().getFullYear() })}</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F9F9FB',
    },
    heroSection: {
        height: 240,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        overflow: 'hidden',
    },
    logoContainer: {
        width: 180,
        height: 80,
        backgroundColor: colors.white,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
    },
    logo: {
        width: 180,
        height: 180,
    },
    heroTitle: {
        fontSize: 28,
        color: colors.white,
        letterSpacing: 1,
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    contentContainer: {
        padding: 20,
        marginTop: -30,
    },
    sectionCard: {
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        alignItems: 'center',
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.lightPurple + '40',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        color: colors.darkPurple,
        marginBottom: 12,
        textAlign: 'center',
    },
    sectionText: {
        fontSize: 15,
        color: '#4A4A4A',
        lineHeight: 24,
        textAlign: 'center',
    },
    footer: {
        marginTop: 20,
        marginBottom: 40,
        alignItems: 'center',
    },
    versionText: {
        fontSize: 14,
        color: colors.mediumGray,
        marginBottom: 4,
    },
    copyrightText: {
        fontSize: 12,
        color: '#A0A0A0',
        textAlign: 'center',
    },
});

export default AboutVivaMama;