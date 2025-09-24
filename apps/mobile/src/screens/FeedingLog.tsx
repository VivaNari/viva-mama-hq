import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../data/infantFeddingLogStyles';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { ActivitiesState, CheckboxProps, FeedingScheduleEntry, MoodsState, SleepLogEntry } from '../types/infantFeedignLog.types';


const Checkmark: React.FC = () => <Text style={styles.checkmarkIcon}>
    <MaterialDesignIcons name='check-circle' size={10} color={colors.white} />
</Text>;


const PlusIcon: React.FC = () => <Text style={styles.plusIcon}>
    <MaterialDesignIcons name='plus' size={15} color={colors.black} />
</Text>;


const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange }) => {
    return (
        <TouchableOpacity activeOpacity={0.5} style={styles.checkboxContainer} onPress={onChange}>
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Checkmark />}
            </View>
            <Text style={[styles.checkboxLabel, globalStyles.fontRegular]}>{label}</Text>
        </TouchableOpacity>
    );
};

const FeedingLogScreen: React.FC = () => {

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [dates, setDates] = useState<Date[]>([]);

    const [feedingSchedule, setFeedingSchedule] = useState<FeedingScheduleEntry[]>([
        { time: '', type: null, amount: '' },
    ]);

    const [sleepLog, setSleepLog] = useState<SleepLogEntry[]>([
        { start: '', end: '', length: '' },
    ]);

    const [activities, setActivities] = useState<ActivitiesState>({
        'Tummy time': false,
        'Bath': false,
        'Reading': false,
        'Music': false,
        'Dancing': false,
        'Sensory toys': false,
    });

    const [moods, setMoods] = useState<MoodsState>({
        'Calm': false,
        'Happy': false,
        'Sleepy': false,
        'Fussy': false,
        'Upset': false,
    });
    useEffect(() => {
        const today = new Date();
        const futureDates = Array.from({ length: 6 }, (_, i) => {
            const date = new Date();
            date.setDate(today.getDate() + i);
            return date;
        });
        setDates(futureDates);
        setSelectedDate(today);
    }, []);

    const handleFeedingChange = (index: number, field: keyof FeedingScheduleEntry, value: string | 'Nursing' | 'Bottle' | 'Pump' | null) => {
        const newSchedule = [...feedingSchedule];
        (newSchedule[index] as any)[field] = value;
        setFeedingSchedule(newSchedule);
    };

    const addMoreFeeding = (): void => {
        setFeedingSchedule([
            ...feedingSchedule,
            { time: '', type: null, amount: '' },
        ]);
    };

    const handleSleepChange = (index: number, field: keyof SleepLogEntry, value: string) => {
        const newLog = [...sleepLog];
        newLog[index][field] = value;
        setSleepLog(newLog);
    };

    const addMoreSleep = (): void => {
        setSleepLog([...sleepLog, { start: '', end: '', length: '' }]);
    };

    const handleActivityToggle = (activity: string): void => {
        setActivities((prev) => ({ ...prev, [activity]: !prev[activity] }));
    };

    const handleMoodToggle = (mood: string): void => {
        setMoods((prev) => ({ ...prev, [mood]: !prev[mood] }));
    };




    const renderDateTab = (date: Date): React.ReactElement => {
        const isSelected = date.toDateString() === selectedDate.toDateString();
        const isToday = date.toDateString() === new Date().toDateString();
        const isDisabled = !isToday;

        return (
            <TouchableOpacity activeOpacity={0.5}
                key={date.toISOString()}
                disabled={isDisabled}
                style={[
                    styles.dateTab,
                    isSelected && styles.selectedDateTab,
                    isDisabled && styles.disabledDateTab,
                ]}
                onPress={() => setSelectedDate(date)}
            >
                <Text
                    style={[
                        globalStyles.fontRegular,
                        styles.dateText,
                        isSelected && styles.selectedDateText,
                        isDisabled && styles.disabledDateText,
                    ]}
                >
                    {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderFeedingSchedule = (): React.ReactElement => (
        <View style={styles.card}>
            <View style={[styles.sectionHeader, { backgroundColor: 'rgba(126, 164, 255, 1)' }]}>
                <Text style={[globalStyles.fontMedium, styles.sectionTitle]}>Feeding Schedule</Text>
            </View>
            {feedingSchedule.map((item, index) => (
                <View key={index} style={styles.row}>
                    <TextInput
                        placeholder="Time"
                        placeholderTextColor={colors.gray}
                        style={[styles.input, styles.timeInput, globalStyles.fontRegular]}
                        value={item.time}
                        onChangeText={(text) => handleFeedingChange(index, 'time', text)}
                    />
                    <View style={styles.radioContainer}>
                        <Text style={[styles.radioLabel, globalStyles.fontRegular]}>Nursing</Text>
                        <TouchableOpacity activeOpacity={0.5}
                            style={[styles.radio, item.type === 'Nursing' && styles.radioSelected]}
                            onPress={() => handleFeedingChange(index, 'type', 'Nursing')}
                        />
                    </View>
                    <View style={styles.radioContainer}>
                        <Text style={[styles.radioLabel, globalStyles.fontRegular]}>Bottle</Text>
                        <TouchableOpacity activeOpacity={0.5}
                            style={[styles.radio, item.type === 'Bottle' && styles.radioSelected]}
                            onPress={() => handleFeedingChange(index, 'type', 'Bottle')}
                        />
                    </View>
                    <View style={styles.radioContainer}>
                        <Text style={[styles.radioLabel, globalStyles.fontRegular]}>Pump</Text>
                        <TouchableOpacity activeOpacity={0.5}
                            style={[styles.radio, item.type === 'Pump' && styles.radioSelected]}
                            onPress={() => handleFeedingChange(index, 'type', 'Pump')}
                        />
                    </View>
                    <TextInput
                        placeholder="ML"
                        placeholderTextColor={colors.gray}
                        style={[styles.input, styles.amountInput, globalStyles.fontRegular]}
                        keyboardType="numeric"
                        value={item.amount}
                        onChangeText={(text) => handleFeedingChange(index, 'amount', text)}
                    />
                </View>
            ))}
            <TouchableOpacity activeOpacity={0.5} style={styles.addMoreButton} onPress={addMoreFeeding}>
                <PlusIcon />
                <Text style={[styles.addMoreText, globalStyles.fontRegular]}>Add more</Text>
            </TouchableOpacity>
        </View>
    );

    const renderSleepLog = (): React.ReactElement => (
        <View style={styles.card}>
            <View style={[styles.sectionHeader, { backgroundColor: 'rgba(126, 164, 255, 1)' }]}>
                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>Sleep</Text>
            </View>
            {sleepLog.map((item, index) => (
                <View key={index} style={styles.sleepRow}>
                    <TextInput
                        placeholder="Start"
                        placeholderTextColor={colors.gray}
                        style={[styles.input, globalStyles.fontRegular]}
                        value={item.start}
                        onChangeText={(text) => handleSleepChange(index, 'start', text)}
                    />
                    <TextInput
                        placeholder="End"
                        placeholderTextColor={colors.gray}
                        style={[styles.input, globalStyles.fontRegular]}
                        value={item.end}
                        onChangeText={(text) => handleSleepChange(index, 'end', text)}
                    />
                    <TextInput
                        placeholder="Length"
                        placeholderTextColor={colors.gray}
                        style={[styles.input, globalStyles.fontRegular]}
                        value={item.length}
                        onChangeText={(text) => handleSleepChange(index, 'length', text)}
                    />
                </View>
            ))}
            <TouchableOpacity activeOpacity={0.5} style={styles.addMoreButton} onPress={addMoreSleep}>
                <PlusIcon />
                <Text style={[styles.addMoreText, globalStyles.fontRegular]}>Add more</Text>
            </TouchableOpacity>
        </View>
    );

    const renderActivities = (): React.ReactElement => (
        <View style={styles.card}>
            <View style={[styles.sectionHeader, { backgroundColor: 'rgba(126, 164, 255, 1)' }]}>
                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>Activities</Text>
            </View>
            {Object.keys(activities).map((activity) => (
                <Checkbox
                    key={activity}
                    label={activity}
                    checked={activities[activity]}
                    onChange={() => handleActivityToggle(activity)}
                />
            ))}
        </View>
    );

    const renderMoods = (): React.ReactElement => (
        <View style={styles.card}>
            <View style={[styles.sectionHeader, { backgroundColor: 'rgba(126, 164, 255, 1)' }]}>
                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>Moods</Text>
            </View>
            {Object.keys(moods).map((mood) => (
                <Checkbox
                    key={mood}
                    label={mood}
                    checked={moods[mood]}
                    onChange={() => handleMoodToggle(mood)}
                />
            ))}
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View
                style={[globalStyles.container, { flex: 0 }]}

            >
                <FlatList
                    horizontal
                    scrollEnabled={true}
                    data={dates}
                    renderItem={({ item }) => renderDateTab(item)}
                    keyExtractor={(item) => item.toISOString()}
                    showsHorizontalScrollIndicator={false}
                    style={styles.dateScrollView}
                />
            </View>


            <ScrollView
                style={[globalStyles.container, {
                    flex: 1,
                }]}
                showsVerticalScrollIndicator={false}
            >
                {renderFeedingSchedule()}
                {renderSleepLog()}
                {renderActivities()}
                {renderMoods()}
            </ScrollView>
        </SafeAreaView>
    );
};



export default FeedingLogScreen;

