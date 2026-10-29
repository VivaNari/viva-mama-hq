import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '../../components/logs/Buttons';
import Chip from '../../components/logs/Chip';
import { TintNote } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import { useMotherLogs } from '../../hooks/useMotherLogs';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { i18nKey, MealFood, MealTime } from '../../types/motherLog.types';

const MEAL_TIMES: MealTime[] = ['breakfast', 'lunch', 'evening_snack', 'dinner'];
const FOODS: MealFood[] = ['dal', 'rice', 'vegetables', 'roti', 'curd', 'fruit', 'egg'];
const OTHER_FOODS: MealFood[] = ['paneer', 'khichdi', 'poha', 'nuts'];

// Which food groups each item counts toward, for the day's nutrition note.
const FOOD_GROUPS: Record<'protein' | 'carbs' | 'vegetables' | 'fruit' | 'dairy', MealFood[]> = {
    protein: ['dal', 'egg', 'paneer', 'nuts'],
    carbs: ['rice', 'roti', 'khichdi', 'poha'],
    vegetables: ['vegetables', 'khichdi'],
    fruit: ['fruit'],
    dairy: ['curd', 'paneer'],
};

// What the (not yet real) plate scan "detects", as in the design.
const SCANNED_FOODS: MealFood[] = ['dal', 'vegetables', 'roti'];

const MealsLog: React.FC = () => {
    const { t } = useTranslation();
    const [time, setTime] = useState<MealTime>('lunch');
    const [selected, setSelected] = useState<Set<MealFood>>(new Set());
    const [customFood, setCustomFood] = useState<MealFood | null>(null);
    const [showOtherFoods, setShowOtherFoods] = useState(false);
    const [scanned, setScanned] = useState(false);
    const { logs: meals, loading, saving, add, confirmRemove } = useMotherLogs({
        types: ['meal'],
        todayOnly: true,
    });

    const foodLabel = (food: MealFood) => t(`logs.meals.foods.${food}`);
    const timeLabel = (mealTime: MealTime) => t(`logs.meals.times.${i18nKey(mealTime)}`);
    const canSave = (selected.size > 0 || customFood !== null) && !saving;

    const nutritionNote = useMemo(() => {
        const eaten = new Set<MealFood>(meals.flatMap(m => m.fields.foods as MealFood[]));
        const missing = (Object.keys(FOOD_GROUPS) as (keyof typeof FOOD_GROUPS)[]).filter(
            group => !FOOD_GROUPS[group].some(food => eaten.has(food)),
        );
        if (missing.length === 0) return t('logs.meals.balanced');
        return t('logs.meals.missing', {
            groups: missing.map(group => t(`logs.meals.groups.${group}`)).join(', '),
        });
    }, [meals, t]);

    const toggleFood = (food: MealFood) =>
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(food)) next.delete(food);
            else next.add(food);
            return next;
        });

    const scanPlate = () => {
        setScanned(true);
        if (selected.size === 0 && !customFood) setSelected(new Set(SCANNED_FOODS));
    };

    const save = async () => {
        if (!canSave) return;
        const foods: MealFood[] = FOODS.filter(food => selected.has(food));
        if (customFood) foods.push(customFood);
        if (await add('meal', { mealTime: time, foods })) {
            setSelected(new Set());
            setCustomFood(null);
            setScanned(false);
        }
    };

    return (
        <LogScreen title={t('logs.meals.title')} contentStyle={{ paddingTop: 18 }}>
            <TouchableOpacity
                onPress={scanPlate}
                accessibilityRole="button"
                style={[logsStyles.dashedButton, { paddingVertical: 13 }, scanned && logsStyles.dashedButtonDone]}
            >
                <Lucide name="camera" size={16} color={scanned ? colors.vivaSuccess : colors.darkPurple} />
                <Text
                    style={[
                        logsStyles.dashedButtonText,
                        { fontSize: 12.5 },
                        scanned && logsStyles.dashedButtonTextDone,
                        globalStyles.fontSemiBold,
                    ]}
                >
                    {scanned ? t('logs.meals.plateScanned') : t('logs.common.takePhoto')}
                </Text>
            </TouchableOpacity>

            {scanned ? (
                <TintNote
                    style={{ borderRadius: 12, paddingVertical: 10 }}
                    text={t('logs.meals.scanDetected', { foods: SCANNED_FOODS.map(foodLabel).join(', ') })}
                />
            ) : null}

            <Text style={[logsStyles.sectionTitle, globalStyles.fontBold]}>{t('logs.meals.whichMeal')}</Text>
            <View style={logsStyles.chipRow}>
                {MEAL_TIMES.map(key => (
                    <Chip
                        key={key}
                        variant="solid"
                        label={timeLabel(key)}
                        selected={time === key}
                        onPress={() => setTime(key)}
                    />
                ))}
            </View>

            <Text style={[logsStyles.sectionTitle, { marginTop: 4 }, globalStyles.fontBold]}>
                {t('logs.meals.whatEat')}
            </Text>
            <View style={logsStyles.chipRow}>
                {FOODS.map(food => (
                    <Chip
                        key={food}
                        variant="soft"
                        label={foodLabel(food)}
                        selected={selected.has(food)}
                        onPress={() => toggleFood(food)}
                    />
                ))}
                <Chip
                    variant="soft"
                    label={customFood ? foodLabel(customFood) : t('logs.meals.addOwn')}
                    selected={customFood !== null}
                    onPress={() => setShowOtherFoods(prev => !prev)}
                />
            </View>

            {showOtherFoods ? (
                <View style={logsStyles.chipRow}>
                    {OTHER_FOODS.map(food => (
                        <Chip
                            key={food}
                            small
                            variant="soft"
                            label={foodLabel(food)}
                            selected={customFood === food}
                            onPress={() => {
                                setCustomFood(prev => (prev === food ? null : food));
                                setShowOtherFoods(false);
                            }}
                        />
                    ))}
                </View>
            ) : null}

            <PrimaryButton label={t('logs.common.saveLog')} onPress={save} disabled={!canSave} style={{ marginTop: 4 }} />

            {loading ? (
                <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 12 }} />
            ) : (
                <>
                    {meals.length > 0 ? (
                        <View style={logsStyles.card}>
                            <Text style={[logsStyles.sectionTitle, { fontSize: 12.5 }, globalStyles.fontBold]}>
                                {t('logs.meals.nutritionTitle')}
                            </Text>
                            <Text style={[logsStyles.tintNoteText, { fontSize: 12, lineHeight: 19 }, globalStyles.fontRegular]}>
                                {nutritionNote}
                            </Text>
                        </View>
                    ) : null}

                    <Text style={[logsStyles.mutedLabel, { fontSize: 12.5, marginTop: 2 }, globalStyles.fontBold]}>
                        {t('logs.meals.todayMeals')}
                    </Text>
                    {meals.length === 0 ? (
                        <Text style={[logsStyles.mutedLabel, globalStyles.fontRegular]}>{t('logs.common.nothingYet')}</Text>
                    ) : null}
                    {meals.map(meal => (
                        <TouchableOpacity
                            key={meal._id}
                            onLongPress={() => confirmRemove(meal)}
                            accessibilityHint={t('logs.common.longPressToRemove')}
                            activeOpacity={0.7}
                            style={[logsStyles.listRow, { justifyContent: 'flex-start' }]}
                        >
                            <Text style={[logsStyles.listRowLabel, { fontSize: 12.5 }, globalStyles.fontRegular]}>
                                <Text style={globalStyles.fontBold}>{timeLabel(meal.fields.mealTime)}</Text>
                                {' · '}
                                {(meal.fields.foods as MealFood[]).map(foodLabel).join(', ')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </>
            )}
        </LogScreen>
    );
};

export default MealsLog;
