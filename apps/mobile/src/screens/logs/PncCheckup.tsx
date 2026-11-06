import React from 'react';
import { useRoute } from '@react-navigation/native';

import CareCheckup, { CareCheckupTab } from './CareCheckup';

/** The postnatal checkup, after the birth. Opens on `params.tab` when given. */
const PncCheckup: React.FC = () => {
    const { params } = useRoute<any>();
    return <CareCheckup kind="pnc" initialTab={params?.tab as CareCheckupTab | undefined} />;
};

export default PncCheckup;
