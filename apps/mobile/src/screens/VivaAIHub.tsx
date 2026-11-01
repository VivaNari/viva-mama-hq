import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import OptionTile from '../components/logs/OptionTile';
import { useScreenEdges } from '../hooks/useScreenEdges';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { logsStyles } from '../public/styles/logsStyles';
import { vivaAiHubStyles as styles } from '../public/styles/vivaAiHubStyles';

/**
 * The Viva AI tab. It used to open the chat straight away; it is now a hub that sends
 * her to chat, logging, a consult, uploads or reminders.
 */
const VivaAIHub: React.FC = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const edges = useScreenEdges();
    // Voice input is not wired yet; the mic only shows its listening state.
    const [listening, setListening] = useState(false);

    const openChat = () => navigation.navigate('ChatWithVivaAI');

    return (
        <SafeAreaView style={logsStyles.screen} edges={edges}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Lucide name="sparkles" size={17} color={colors.white} />
                </View>
                <View>
                    <Text style={[styles.title, globalStyles.fontBold]}>{t('vivaHub.title')}</Text>
                    <Text style={[styles.subtitle, globalStyles.fontRegular]}>{t('vivaHub.subtitle')}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={styles.heroTitleRow}>
                        <View style={styles.heroIcon}>
                            <Lucide name="sparkles" size={18} color={colors.white} />
                        </View>
                        <Text style={[styles.heroTitle, globalStyles.fontBold]}>{t('vivaHub.heroTitle')}</Text>
                    </View>

                    <Text style={[styles.heroBody, globalStyles.fontRegular]}>{t('vivaHub.heroBody')}</Text>

                    <View style={styles.askBar}>
                        <TouchableOpacity style={{ flex: 1 }} onPress={openChat} accessibilityRole="button">
                            <Text
                                style={[
                                    styles.askText,
                                    listening && styles.askTextListening,
                                    listening ? globalStyles.fontSemiBold : globalStyles.fontRegular,
                                ]}
                            >
                                {listening ? t('vivaHub.listening') : t('vivaHub.askPlaceholder')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setListening(prev => !prev)}
                            accessibilityRole="button"
                            accessibilityLabel={t('vivaHub.askByVoice')}
                            style={[styles.micButton, listening && styles.micButtonListening]}
                        >
                            <Lucide
                                name="mic"
                                size={16}
                                color={listening ? colors.vivaMicActive : colors.darkPurple}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={[styles.sectionLabel, globalStyles.fontBold]}>{t('vivaHub.canHelpWith')}</Text>

                <View style={logsStyles.tileGrid}>
                    <OptionTile icon="message-square-more" label={t('vivaHub.askQuestion')} onPress={openChat} />
                    <OptionTile
                        icon="pencil-line"
                        label={t('vivaHub.logSomething')}
                        onPress={() => navigation.navigate('LogPicker')}
                    />
                    <OptionTile
                        icon="calendar-check"
                        label={t('vivaHub.bookConsult')}
                        onPress={() => navigation.navigate('Experts')}
                    />
                    <OptionTile
                        icon="upload"
                        label={t('vivaHub.uploadRecords')}
                        onPress={() => navigation.navigate('RecordsUpload')}
                    />
                    <OptionTile
                        icon="bell"
                        wide
                        label={t('vivaHub.setReminder')}
                        sub={t('vivaHub.setReminderSub')}
                        onPress={() => navigation.navigate('Reminders')}
                    />
                    <OptionTile
                        icon="folder-heart"
                        wide
                        label={t('vivaHub.myRecords')}
                        sub={t('vivaHub.myRecordsSub')}
                        onPress={() => navigation.navigate('HealthRecords')}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default VivaAIHub;
