import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import LogScreen from '../../components/logs/LogScreen';
import OptionTile from '../../components/logs/OptionTile';
import { getMainTiles, LogTile, PRIVATE_ALSO_TRACK_TILES } from '../../data/logPickerData';
import { useCareContext } from '../../hooks/useCareContext';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { CareModelEnum } from '../../types/user.types';

/**
 * "What would you like to log?" The design shows Public/Private and Pregnancy/Postpartum
 * toggles for demo purposes only; here both come from her profile (see useCareContext).
 */
const LogPicker: React.FC = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { careModel, category, loading } = useCareContext();
    const isPublic = careModel === CareModelEnum.PUBLIC;

    const renderTile = (tile: LogTile) => (
        <OptionTile
            key={tile.key}
            icon={tile.icon}
            label={t(`logs.picker.${tile.labelKey}`)}
            sub={tile.subKey ? t(`logs.picker.${tile.subKey}`) : undefined}
            tone={tile.tone}
            wide={tile.wide}
            large={isPublic}
            onPress={() => navigation.navigate(tile.screen)}
        />
    );

    return (
        <LogScreen title={t('logs.picker.title')}>
            {loading ? (
                <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} />
            ) : (
                <>
                    {isPublic ? (
                        <Text style={[logsStyles.mutedLabel, { lineHeight: 18 }, globalStyles.fontRegular]}>
                            {t('logs.picker.publicHint')}
                        </Text>
                    ) : null}

                    <View style={logsStyles.tileGrid}>{getMainTiles(careModel, category).map(renderTile)}</View>

                    {!isPublic ? (
                        <View style={{ marginTop: 4, gap: 10 }}>
                            <Text style={[logsStyles.capsLabel, { fontSize: 11.5 }, globalStyles.fontBold]}>
                                {t('logs.picker.alsoTrack')}
                            </Text>
                            <View style={logsStyles.tileGrid}>{PRIVATE_ALSO_TRACK_TILES.map(renderTile)}</View>
                        </View>
                    ) : null}
                </>
            )}
        </LogScreen>
    );
};

export default LogPicker;
