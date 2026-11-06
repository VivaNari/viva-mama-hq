import React from 'react';
import { useRoute } from '@react-navigation/native';

import CareCheckup, { CareCheckupTab } from './CareCheckup';

/** The antenatal checkup, while she is pregnant. Opens on `params.tab` when given. */
const AncCheckup: React.FC = () => {
    const { params } = useRoute<any>();
    return <CareCheckup kind="anc" initialTab={params?.tab as CareCheckupTab | undefined} />;
};

export default AncCheckup;
