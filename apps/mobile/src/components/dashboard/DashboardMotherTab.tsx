import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import JourneyMotherView from '../journey/JourneyMotherView';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IUserAllData } from '../../types/dashboard.types';
import { JourneyPosition } from '../../utils/journeyPosition';
import CareManagerCard from '../CareManagerCard';
import HealthSummaryCard from './HealthSummaryCard';

interface DashboardMotherTabProps {
    position: JourneyPosition;
    userData: IUserAllData | undefined;
    onChanged: () => void;
}

const DashboardMotherTab: React.FC<DashboardMotherTabProps> = ({ position, userData, onChanged }) => {
    const { t } = useTranslation();

    return (
        <View>
            <JourneyMotherView position={position} userData={userData} onChanged={onChanged} />

            <HealthSummaryCard />

            <CareManagerCard />
            <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5, marginBottom: 15, textAlign: 'center' }]}>
                {t('dashboard.careManagerDisclaimer')}
            </Text>
        </View>
    );
};

export default DashboardMotherTab;
