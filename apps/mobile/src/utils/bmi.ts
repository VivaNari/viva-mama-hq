import { colors } from '../public/assets/colors';

/** BMI to one decimal place, or null when her height is not recorded. */
export const bmiFor = (weightKg: number, heightCm: number | null): number | null => {
    if (!heightCm) return null;
    const heightM = heightCm / 100;
    return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
};

export interface BmiBand {
    /** i18n key under `logs.weight`. */
    labelKey: 'bmiUnder' | 'bmiNormal' | 'bmiOver';
    color: string;
    /** Where the range bar sits; a fixed position per band, as in the design. */
    percent: number;
}

export const bmiBand = (bmi: number): BmiBand => {
    if (bmi < 18.5) return { labelKey: 'bmiUnder', color: colors.vivaWarning, percent: 25 };
    if (bmi >= 25) return { labelKey: 'bmiOver', color: colors.vivaWarning, percent: 80 };
    return { labelKey: 'bmiNormal', color: colors.vivaSuccess, percent: 55 };
};
