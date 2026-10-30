import { CareModelEnum, UserCategoryEnum } from '../types/user.types';

/** Visual treatment of a tile; matches the three card colours in the design. */
export type LogTileTone = 'default' | 'reading' | 'mood';

export interface LogTile {
    key: string;
    /** i18n key under `logs.picker`. */
    labelKey: string;
    /** Optional second line, i18n key under `logs.picker`. */
    subKey?: string;
    icon: string;
    /** AppStack route the tile opens. */
    screen: string;
    tone?: LogTileTone;
    /** Spans both grid columns. */
    wide?: boolean;
}

// The public route keeps to the few logs a mother can do herself; the clinic card and
// her reports fill in the rest. "Baby moved today" only makes sense while pregnant.
const PUBLIC_TILES: LogTile[] = [
    { key: 'medicines', labelKey: 'medicinesSupplements', icon: 'pill', screen: 'MedicineLog' },
    { key: 'babyMoved', labelKey: 'babyMovedToday', icon: 'heart', screen: 'KickCounter' },
    { key: 'mood', labelKey: 'howIFeelToday', icon: 'smile', screen: 'MoodLog' },
    { key: 'upload', labelKey: 'uploadCardOrReport', icon: 'upload', screen: 'RecordsUpload' },
];

const PUBLIC_READING_TILE: LogTile = {
    key: 'reading',
    labelKey: 'aReading',
    subKey: 'aReadingSub',
    icon: 'heart-pulse',
    screen: 'ReadingsLog',
    tone: 'reading',
    wide: true,
};

const PRIVATE_PREGNANCY_TILES: LogTile[] = [
    { key: 'kicks', labelKey: 'babyMovementKicks', icon: 'heart', screen: 'KickCounter' },
    { key: 'anc', labelKey: 'ancCheckup', icon: 'calendar', screen: 'AncCheckup' },
    { key: 'scans', labelKey: 'scansReports', icon: 'scan-line', screen: 'RecordsUpload' },
    { key: 'weight', labelKey: 'weightBmi', icon: 'scale', screen: 'WeightBmiLog' },
];

const PRIVATE_POSTPARTUM_TILES: LogTile[] = [
    { key: 'pumping', labelKey: 'pumping', icon: 'droplet', screen: 'PumpingLog' },
    { key: 'meals', labelKey: 'meals', icon: 'utensils', screen: 'MealsLog' },
    { key: 'water', labelKey: 'water', icon: 'glass-water', screen: 'WaterLog' },
    { key: 'weight', labelKey: 'weightBmi', icon: 'scale', screen: 'WeightBmiLog' },
];

export const PRIVATE_ALSO_TRACK_TILES: LogTile[] = [
    { key: 'readings', labelKey: 'bpSugarWeight', icon: 'heart-pulse', screen: 'ReadingsLog', tone: 'reading' },
    { key: 'medicines', labelKey: 'medicines', icon: 'pill', screen: 'MedicineLog' },
    { key: 'mood', labelKey: 'moodCheckIn', icon: 'smile', screen: 'MoodLog', tone: 'mood', wide: true },
];

// An odd count leaves a hole in the two-column grid, so the last tile spans the row.
const fillGrid = (tiles: LogTile[]): LogTile[] =>
    tiles.length % 2 === 1
        ? [...tiles.slice(0, -1), { ...tiles[tiles.length - 1], wide: true }]
        : tiles;

/** The main tile set for her route and stage. */
export const getMainTiles = (
    careModel: CareModelEnum,
    category: UserCategoryEnum | null,
): LogTile[] => {
    if (careModel === CareModelEnum.PUBLIC) {
        const tiles = PUBLIC_TILES.filter(
            tile => tile.key !== 'babyMoved' || category === UserCategoryEnum.NP,
        );
        return [...fillGrid(tiles), PUBLIC_READING_TILE];
    }

    if (category === UserCategoryEnum.NP) return PRIVATE_PREGNANCY_TILES;
    if (category === UserCategoryEnum.PP) return PRIVATE_POSTPARTUM_TILES;

    // Neither pregnant nor postpartum: the postpartum set without pumping.
    return fillGrid(PRIVATE_POSTPARTUM_TILES.filter(tile => tile.key !== 'pumping'));
};
