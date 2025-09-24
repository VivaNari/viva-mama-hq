import React, { useState } from 'react';
import {
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VACCINATION_DATA } from '../data/infantVacineData';
import { globalStyles } from '../public/styles';
import { styles } from '../public/styles/infantStyles';
import { Tab, ToggleSwitchProps, VaccinationData, VaccineCardProps, VaccineStatus } from '../types/infantVaccine.types';


const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ vaccineName, status, onToggle }) => {
    const isEnabled = status === 'Yes';

    const handleValueChange = (newValue: boolean) => {
        onToggle(vaccineName, newValue ? 'Yes' : 'No');
    };

    return (
        <Switch
            trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
            thumbColor={isEnabled ? '#4338CA' : '#F9FAFB'}
            ios_backgroundColor="#E5E7EB"
            onValueChange={handleValueChange}
            value={isEnabled}
        />
    );
};

const VaccineCard: React.FC<VaccineCardProps> = ({ vaccines, onToggle }) => (
    <View style={styles.card}>
        <Text style={[styles.cardQuestion, globalStyles.fontRegular]}>Does the baby is vaccinated with:</Text>
        {vaccines.map((vaccine) => (
            <View key={vaccine.name} style={styles.vaccineRow}>
                <View style={styles.vaccineInfo}>
                    <Text style={[globalStyles.fontRegular, styles.vaccineName]}>{vaccine.name}</Text>
                    {vaccine.description && (
                        <Text style={[globalStyles.fontRegular, styles.vaccineDescription]}>{vaccine.description}</Text>
                    )}
                </View>
                <ToggleSwitch
                    vaccineName={vaccine.name}
                    status={vaccine.status}
                    onToggle={onToggle}
                />
            </View>
        ))}
    </View>
);


const VaccinationLogScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('Birth');
    const [vaccinationData, setVaccinationData] = useState<VaccinationData>(VACCINATION_DATA);

    const handleToggle = (vaccineName: string, newStatus: VaccineStatus) => {
        setVaccinationData((prevData) => {
            const updatedVaccines = prevData[activeTab].map((vaccine) =>
                vaccine.name === vaccineName ? { ...vaccine, status: newStatus } : vaccine
            );
            return { ...prevData, [activeTab]: updatedVaccines };
        });
    };

    const tabs: Tab[] = ['Birth', '6 Weeks', '10 Weeks'];

    return (
        <SafeAreaView style={globalStyles.container}>

            <View style={styles.tabContainer}>
                {tabs.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[globalStyles.fontRegular, styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer}>
                <VaccineCard
                    vaccines={vaccinationData[activeTab]}
                    onToggle={handleToggle}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

export default VaccinationLogScreen;

