import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import { LinkButton, PrimaryButton } from '../../components/logs/Buttons';
import Chip from '../../components/logs/Chip';
import { DoneState } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';

const CATEGORIES = ['scan', 'lab', 'prescription', 'mch'] as const;
const SCAN_TYPES = ['dating', 'anomaly', 'growth'] as const;

type Category = (typeof CATEGORIES)[number];
type ScanType = (typeof SCAN_TYPES)[number];

/**
 * Add a scan, lab report, prescription or MCH card. UI only: there is no image picker
 * in the app yet, so the photo button just marks a photo as attached.
 */
const RecordsUpload: React.FC = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [category, setCategory] = useState<Category>('scan');
    const [scanType, setScanType] = useState<ScanType | null>(null);
    const [photoAdded, setPhotoAdded] = useState(false);
    const [done, setDone] = useState(false);

    const ready = category !== 'scan' || scanType !== null;

    const pickCategory = (next: Category) => {
        setCategory(next);
        if (next !== 'scan') setScanType(null);
    };

    const itemLabel =
        category === 'scan' && scanType
            ? t(`logs.records.scanTypesShort.${scanType}`)
            : t(`logs.records.categories.${category}`);

    const doneSubtitle =
        category === 'mch'
            ? t('logs.records.savedMch')
            : photoAdded
              ? t('logs.records.savedWithPhoto')
              : t('logs.records.saved');

    if (done) {
        return (
            <LogScreen title={t('logs.records.title')} contentStyle={{ paddingTop: 18 }}>
                <DoneState
                    title={t('logs.records.logged', { item: itemLabel })}
                    subtitle={doneSubtitle}
                    actionLabel={t('logs.common.logMore')}
                    onAction={() => navigation.navigate('LogPicker')}
                />
            </LogScreen>
        );
    }

    return (
        <LogScreen title={t('logs.records.title')} contentStyle={{ paddingTop: 18 }}>
            <Text style={[logsStyles.questionTitle, globalStyles.fontBold]}>{t('logs.records.whatAdding')}</Text>
            <View style={logsStyles.chipRow}>
                {CATEGORIES.map(key => (
                    <Chip
                        key={key}
                        variant="solid"
                        label={t(`logs.records.categories.${key}`)}
                        selected={category === key}
                        onPress={() => pickCategory(key)}
                    />
                ))}
            </View>

            {category === 'mch' ? (
                <View style={logsStyles.mchNote}>
                    <View style={[logsStyles.tileIcon, logsStyles.tileIconOnTone]}>
                        <Lucide name="clipboard-list" size={16} color={colors.darkPurple} />
                    </View>
                    <Text style={[logsStyles.mchNoteText, globalStyles.fontRegular]}>{t('logs.records.mchNote')}</Text>
                </View>
            ) : null}

            {category === 'scan' ? (
                <View style={{ gap: 10 }}>
                    <Text style={[logsStyles.fieldLabel, { fontSize: 12.5 }, globalStyles.fontSemiBold]}>
                        {t('logs.records.whichScan')}
                    </Text>
                    {SCAN_TYPES.map(key => (
                        <TouchableOpacity
                            key={key}
                            onPress={() => setScanType(key)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: scanType === key }}
                            style={[logsStyles.choiceCard, scanType === key && logsStyles.choiceCardOn]}
                        >
                            <Text style={[logsStyles.itemTitle, globalStyles.fontSemiBold]}>
                                {t(`logs.records.scanTypes.${key}`)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}

            <TouchableOpacity
                onPress={() => setPhotoAdded(true)}
                accessibilityRole="button"
                style={[logsStyles.dashedButton, photoAdded && logsStyles.dashedButtonDone]}
            >
                {photoAdded ? <Lucide name="check" size={16} color={colors.vivaSuccess} /> : null}
                <Text
                    style={[
                        logsStyles.dashedButtonText,
                        photoAdded && logsStyles.dashedButtonTextDone,
                        globalStyles.fontSemiBold,
                    ]}
                >
                    {photoAdded ? t('logs.records.photoAdded') : t('logs.common.takePhoto')}
                </Text>
            </TouchableOpacity>

            {photoAdded ? (
                <LinkButton label={t('logs.records.removePhoto')} onPress={() => setPhotoAdded(false)} />
            ) : null}

            <PrimaryButton
                label={t('logs.common.saveLog')}
                onPress={() => setDone(true)}
                disabled={!ready}
                style={{ marginTop: 4 }}
            />
        </LogScreen>
    );
};

export default RecordsUpload;
