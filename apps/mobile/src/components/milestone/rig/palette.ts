/**
 * The milestone illustrations' colours.
 *
 * Lifted from the design artifact so the ported scenes match what was approved there. The
 * palette is deliberately its own module rather than part of the app's `colors`: these are
 * illustration pigments — skin, hair, nursery walls — not UI tokens, and nothing outside
 * these scenes should reach for them.
 */

export type SkinTone = 'light' | 'warm' | 'deep';

export interface SkinPalette {
    /** Lit surfaces — face, hands, near limbs. */
    skin: string;
    /** Shaded surfaces — far limbs, the underside of the jaw. */
    shade: string;
    /** Hair, brows. */
    hair: string;
}

/**
 * Three tones rather than one.
 *
 * A single default would make most of the mothers using this app look at a baby that is not
 * theirs. `warm` is the default because it sits in the middle of the range this app serves.
 */
export const SKIN: Record<SkinTone, SkinPalette> = {
    light: { skin: '#F0C9A8', shade: '#DCAE87', hair: '#6B4A2F' },
    warm: { skin: '#E0A97E', shade: '#C98F63', hair: '#4A3328' },
    deep: { skin: '#A9713F', shade: '#8E5B2F', hair: '#2E1D14' },
};

export const DEFAULT_SKIN: SkinTone = 'warm';

export const SCENE = {
    wallTop: '#F3F1FC',
    wallBottom: '#E9E5F8',
    floor: '#E0DBF3',
    skirting: '#D4CDEC',
    windowFill: '#F8F6FF',
    windowFrame: '#E5E0F6',
    furniture: '#E6E1F7',
    matStripeA: '#D5CCF3',
    matStripeB: '#DFD8F7',
    matInner: '#E7E2F9',
    shadow: 'rgba(74,54,126,0.18)',
    romper: '#E4EFE5',
    romperShade: '#CADBCD',
    accent: '#7C4DE0',
    toyPink: '#F3C4D4',
    toyLilac: '#C9BDF2',
    eye: '#3B2B26',
    mouth: '#B8635C',
    cheek: 'rgba(224,126,116,0.32)',
    backdrop: '#EFEDFA',
} as const;
