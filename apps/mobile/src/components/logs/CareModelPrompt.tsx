import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { PrimaryButton } from './Buttons';

/**
 * Shown when her care route is not known. Public and private care have different logs and
 * schedules, so the app asks rather than guess which one she is on.
 *
 * The screen re-reads her profile on focus (useCareContext), so it updates by itself when
 * she comes back from Edit Profile.
 */
const CareModelPrompt: React.FC = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();

    return (
        <View style={[logsStyles.tintNote, { gap: 10, paddingHorizontal: 16 }]}>
            <Text style={[logsStyles.tintNoteText, { fontSize: 14 }, globalStyles.fontBold]}>
                {t('logs.careModelPrompt.title')}
            </Text>
            <Text style={[logsStyles.tintNoteText, { fontSize: 13 }, globalStyles.fontRegular]}>
                {t('logs.careModelPrompt.body')}
            </Text>
            <PrimaryButton
                label={t('logs.careModelPrompt.action')}
                onPress={() => navigation.navigate('EditProfile')}
            />
        </View>
    );
};

export default CareModelPrompt;
