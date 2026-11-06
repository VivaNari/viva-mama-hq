import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';
import { IUserAllData } from '../../types/dashboard.types';
import { careRoute, hasGestationalDiabetes } from '../../utils/careSchedule';
import { JourneyPosition } from '../../utils/journeyPosition';
import CardRail from './CardRail';
import ComingUpCard from './ComingUpCard';
import DeliveryPrompt, { showsDeliveryPrompt } from './DeliveryPrompt';
import HappeningCard from './HappeningCard';
import RememberCard from './RememberCard';
import StageBar from './StageBar';
import WhenToGetHelp from './WhenToGetHelp';

interface JourneyMotherViewProps {
    position: JourneyPosition;
    userData: IUserAllData | undefined;
    /** Re-read her profile after something here changed her stage. */
    onChanged: () => void;
}

/** Where no stage applies: a plain, kind card and nothing that assumes a pregnancy or a baby. */
const Notice: React.FC<{ kind: 'loss' | 'notPregnant' | 'noDates' }> = ({ kind }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();

    return (
        <View style={styles.notice}>
            <Text style={[styles.cardHeading, globalStyles.fontBold]}>{t(`journey.notice.${kind}Title`)}</Text>
            <Text style={[styles.cardBody, globalStyles.fontRegular]}>{t(`journey.notice.${kind}Body`)}</Text>
            {kind !== 'loss' ? (
                <TouchableOpacity
                    style={[styles.bigButton, { backgroundColor: colors.darkPurple }]}
                    onPress={() => navigation.navigate('EditProfile')}
                    accessibilityRole="button"
                >
                    <Text style={[styles.bigButtonText, globalStyles.fontSemiBold]}>{t('journey.notice.editProfile')}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

/** The Journey tab's Mother view: the stage bar, three cards, and when to get help. */
const JourneyMotherView: React.FC<JourneyMotherViewProps> = ({ position, userData, onChanged }) => {
    const data = userData?.user?.onboarding_data;
    const route = careRoute(data?.care_model ?? null);

    const context = useMemo(
        () => ({
            deliveryType: data?.delivery_type ?? null,
            deliveryOutcome: data?.delivery_outcome ?? null,
            hasGdm: hasGestationalDiabetes(data),
        }),
        [data],
    );

    if (position.kind !== 'pregnant' && position.kind !== 'postpartum') {
        return (
            <View>
                <Notice kind={position.kind} />
                <WhenToGetHelp helpSet={position.helpSet} />
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <StageBar position={position} />
            {position.kind === 'pregnant' && showsDeliveryPrompt(position) ? (
                <DeliveryPrompt position={position} onChanged={onChanged} />
            ) : null}
            <CardRail>
                <HappeningCard position={position} route={route} />
                <ComingUpCard position={position} route={route} context={context} />
                <RememberCard position={position} route={route} />
            </CardRail>
            <WhenToGetHelp helpSet={position.helpSet} />
        </View>
    );
};

export default JourneyMotherView;
