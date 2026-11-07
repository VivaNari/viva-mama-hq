import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { COUNSELLOR_PORTRAIT, DOCTOR_PORTRAIT, JOURNEY_FIGURES } from './artwork';
import {
    ArtPanel,
    Caption,
    DrawnStroke,
    EASE_LINEAR,
    EASE_POP,
    INTRO_COLORS,
    IntroIconName,
    IntroText,
    LineIcon,
    Reveal,
    useIntroTiming,
    VIVA_AVATAR,
} from './shared';

const SIA_PHOTO = require('../../public/assets/images/welcomeIntro/sia.jpg');

interface ISlideProps {
    on: boolean;
}

const POP = { easing: EASE_POP, from: { scale: 0.6 } };

const JOURNEY_NODES = [
    { left: 16, top: 176, ring: '#B794F6', delay: 500 },
    { left: 98, top: 106, ring: '#9D6BF0', delay: 950 },
    { left: 178, top: 176, ring: '#8B4FEA', delay: 1380 },
    { left: 258, top: 106, ring: '#6814DB', delay: 1800 },
];

const JOURNEY_DOTS = [
    { left: 52, color: '#B794F6', delay: 600 },
    { left: 134, color: '#9D6BF0', delay: 1050 },
    { left: 214, color: '#8B4FEA', delay: 1480 },
    { left: 294, color: '#6814DB', delay: 1900 },
];

const JOURNEY_LABELS = [
    { key: 'pregnancy', left: 3, top: 268, width: 110, delay: 600 },
    { key: 'delivery', left: 80, top: 80, width: 120, delay: 1050 },
    { key: 'postpartum', left: 165, top: 268, width: 110, delay: 1480 },
    { key: 'motherhood', left: 245, top: 50, width: 110, delay: 1900 },
];

const WAVE_PATH =
    'M-8 252C3 246.3 33.3 235.3 58 218C82.7 200.7 113 148 140 148C167 148 193.3 218 220 218C246.7 218 275.7 165.3 300 148C324.3 130.7 355 119.7 366 114';

/** Slide 2: the 1,000-day wave, with each stage popping in as the line reaches it. */
export const JourneySlide = ({ on }: ISlideProps) => {
    const { t } = useTranslation();
    const animate = useIntroTiming();
    const draw = useSharedValue(0);

    useEffect(() => {
        if (on) {
            draw.value = animate(1, { delay: 300, duration: 1800, easing: EASE_LINEAR });
        }
    }, [on, animate, draw]);

    return (
        <>
            <ArtPanel on={on}>
                <Svg width={358} height={432} style={StyleSheet.absoluteFill}>
                    <Path d={WAVE_PATH} stroke={INTRO_COLORS.track} strokeWidth={6} strokeLinecap="round" fill="none" />
                    <DrawnStroke d={WAVE_PATH} stroke={INTRO_COLORS.purple} strokeWidth={6} length={476.2} progress={draw} />
                    <Path d="M24 342H328" stroke={INTRO_COLORS.track} strokeWidth={3} strokeLinecap="round" />
                    <DrawnStroke d="M24 342H328" stroke={INTRO_COLORS.lilac} strokeWidth={3} length={304} progress={draw} />
                </Svg>
                <Reveal on={on} delay={2050} duration={300} style={StyleSheet.absoluteFill}>
                    <Svg width={358} height={432}>
                        <Path
                            d="M322 335.5L330 342L322 348.5"
                            stroke={INTRO_COLORS.purple}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                    </Svg>
                </Reveal>

                {JOURNEY_DOTS.map(item => (
                    <Reveal
                        key={item.left}
                        on={on}
                        delay={item.delay}
                        {...POP}
                        style={[styles.journeyDot, { left: item.left, backgroundColor: item.color }]}
                    />
                ))}

                {JOURNEY_NODES.map((node, index) => (
                    <Reveal
                        key={node.left}
                        on={on}
                        delay={node.delay}
                        duration={550}
                        {...POP}
                        style={[styles.journeyNode, { left: node.left, top: node.top, borderColor: node.ring }]}
                    >
                        <SvgXml width={60} height={60} xml={JOURNEY_FIGURES[index]} />
                    </Reveal>
                ))}

                {JOURNEY_LABELS.map(label => (
                    <Reveal
                        key={label.key}
                        on={on}
                        delay={label.delay}
                        duration={400}
                        style={[styles.absolute, { left: label.left, top: label.top, width: label.width }]}
                    >
                        <IntroText font="semibold" size={14} style={styles.centered}>
                            {t(`welcomeIntro.slide2.${label.key}`)}
                        </IntroText>
                    </Reveal>
                ))}

                <Reveal on={on} delay={2100} duration={400} style={styles.journeyDays}>
                    <IntroText font="heading" size={14} color={INTRO_COLORS.purple} style={styles.centered}>
                        {t('welcomeIntro.slide2.days')}
                    </IntroText>
                </Reveal>
            </ArtPanel>
            <Caption on={on} title={t('welcomeIntro.slide2.title')} body={t('welcomeIntro.slide2.body')} />
        </>
    );
};

const CHAT_REPLY_DELAY_MS = 1500;

/** Slide 3: a question at 3 AM, Viva typing, then her reply. */
export const AskSlide = ({ on }: ISlideProps) => {
    const { t } = useTranslation();
    const reduced = useReducedMotion();
    const [replied, setReplied] = useState(false);

    useEffect(() => {
        if (!on) {
            return;
        }
        const timer = setTimeout(() => setReplied(true), reduced ? 0 : CHAT_REPLY_DELAY_MS);
        return () => clearTimeout(timer);
    }, [on, reduced]);

    return (
        <>
            <ArtPanel on={on}>
                <Reveal on={on} delay={100} duration={600} from={{ y: 12 }} style={styles.chatCard}>
                    <View style={styles.chatHeader}>
                        <Image source={VIVA_AVATAR} style={styles.chatHeaderAvatar} />
                        <View>
                            <IntroText font="heading" size={15} lineHeight={1.2}>
                                {t('welcomeIntro.slide3.vivaName')}
                            </IntroText>
                            <IntroText size={12.5} color={INTRO_COLORS.muted}>
                                {t('welcomeIntro.slide3.vivaRole')}
                            </IntroText>
                        </View>
                    </View>

                    <View style={styles.chatBody}>
                        <Reveal on={on} delay={300} duration={400} style={styles.selfCenter}>
                            <IntroText size={12} color={INTRO_COLORS.muted}>
                                {t('welcomeIntro.slide3.time')}
                            </IntroText>
                        </Reveal>

                        <Reveal on={on} delay={450} duration={500} from={{ x: 18 }} style={styles.userMessage}>
                            <IntroText size={14.5} lineHeight={1.4}>
                                {t('welcomeIntro.slide3.question')}
                            </IntroText>
                        </Reveal>

                        <View style={styles.vivaRow}>
                            <Image source={VIVA_AVATAR} style={styles.vivaRowAvatar} />
                            <Reveal on={on && !replied} delay={200} duration={250} style={styles.typingBubble}>
                                <View style={styles.typingDot} />
                                <View style={[styles.typingDot, styles.typingDotMid]} />
                                <View style={[styles.typingDot, styles.typingDotFaint]} />
                            </Reveal>
                            <Reveal on={replied} duration={500} from={{ y: 10 }} style={styles.vivaMessage}>
                                <IntroText font="heading" size={12.5} color={INTRO_COLORS.purple}>
                                    {t('welcomeIntro.slide3.vivaName')}
                                </IntroText>
                                <IntroText size={14.5} lineHeight={1.4}>
                                    {t('welcomeIntro.slide3.answer')}
                                </IntroText>
                                <Reveal on={replied} delay={450} {...POP} style={styles.verifiedRow}>
                                    <View style={styles.verifiedMark}>
                                        <LineIcon name="check" size={12} color={INTRO_COLORS.white} weight={3.2} />
                                    </View>
                                    <IntroText font="bold" size={12.5}>
                                        {t('welcomeIntro.slide3.badge')}
                                    </IntroText>
                                </Reveal>
                            </Reveal>
                        </View>
                    </View>

                    <Reveal on={on} delay={350} duration={400} style={styles.chatInput}>
                        <IntroText size={14} color={INTRO_COLORS.muted} numberOfLines={1} style={styles.flex}>
                            {t('welcomeIntro.slide3.placeholder')}
                        </IntroText>
                        <View style={[styles.chatInputButton, styles.chatInputMic]}>
                            <LineIcon name="mic" size={16} color={INTRO_COLORS.purple} weight={2.2} />
                        </View>
                        <View style={[styles.chatInputButton, styles.chatInputSend]}>
                            <LineIcon name="arrowUp" size={16} color={INTRO_COLORS.white} weight={2.4} />
                        </View>
                    </Reveal>
                </Reveal>
            </ArtPanel>
            <Caption on={on} title={t('welcomeIntro.slide3.title')} body={t('welcomeIntro.slide3.body')} />
        </>
    );
};

const REPORT_ROWS: { icon: IntroIconName; title: string; status?: string; delay: number }[] = [
    { icon: 'image', title: 'ultrasound', status: 'saved', delay: 500 },
    { icon: 'file', title: 'bloodTest', status: 'explained', delay: 650 },
    { icon: 'pill', title: 'prescription', delay: 800 },
];

const PHONE_SLIDE_IN = { from: { x: 26 }, duration: 500 };

/** Slide 4: a phone with reports filed away and a health summary ready. */
export const ReportsSlide = ({ on }: ISlideProps) => {
    const { t } = useTranslation();

    return (
        <>
            <ArtPanel on={on}>
                <Reveal on={on} delay={100} duration={800} from={{ y: 26 }} style={styles.phone}>
                    <View style={styles.phoneScreen}>
                        <View style={styles.phoneSpeaker} />
                        <View style={styles.phoneHeader}>
                            <Image source={SIA_PHOTO} style={styles.phoneHeaderPhoto} />
                            <IntroText font="heading" size={15} lineHeight={1.2} numberOfLines={1}>
                                {t('welcomeIntro.slide4.reports')}
                            </IntroText>
                        </View>

                        {REPORT_ROWS.map(row => (
                            <Reveal key={row.title} on={on} delay={row.delay} {...PHONE_SLIDE_IN} style={styles.reportRow}>
                                <View style={styles.reportIcon}>
                                    <LineIcon name={row.icon} size={18} color={INTRO_COLORS.purple} />
                                </View>
                                <View style={styles.flex}>
                                    <IntroText font="bold" size={13.5} lineHeight={1.2} numberOfLines={1}>
                                        {t(`welcomeIntro.slide4.${row.title}`)}
                                    </IntroText>
                                    {row.status ? (
                                        <IntroText font="semibold" size={11.5} color={INTRO_COLORS.purple}>
                                            {t(`welcomeIntro.slide4.${row.status}`)}
                                        </IntroText>
                                    ) : null}
                                </View>
                            </Reveal>
                        ))}

                        <Reveal on={on} delay={950} {...PHONE_SLIDE_IN} style={styles.summaryRow}>
                            <View style={styles.summaryIcon}>
                                <LineIcon name="clipboard" size={17} color={INTRO_COLORS.purple} />
                            </View>
                            <IntroText font="bold" size={13.5} lineHeight={1.2} color={INTRO_COLORS.purple} numberOfLines={1} style={styles.flex}>
                                {t('welcomeIntro.slide4.summary')}
                            </IntroText>
                            <LineIcon name="chevronRight" size={16} color={INTRO_COLORS.purple} weight={2.2} />
                        </Reveal>

                        <Reveal on={on} delay={1100} {...PHONE_SLIDE_IN} style={styles.addRow}>
                            <View style={styles.addIcon}>
                                <LineIcon name="plus" size={18} color={INTRO_COLORS.white} weight={2.4} />
                            </View>
                            <IntroText font="bold" size={13.5} lineHeight={1.2} color={INTRO_COLORS.purple} numberOfLines={1}>
                                {t('welcomeIntro.slide4.add')}
                            </IntroText>
                        </Reveal>
                    </View>
                </Reveal>
            </ArtPanel>
            <Caption on={on} title={t('welcomeIntro.slide4.title')} body={t('welcomeIntro.slide4.body')} />
        </>
    );
};

const REMINDERS = [
    { key: 'vitamin', top: 50, delay: 200 },
    { key: 'vaccine', top: 144, delay: 420 },
    { key: 'appointment', top: 238, delay: 640 },
];

/** Slide 5: Viva's reminders dropping in one after another. */
export const RemindersSlide = ({ on }: ISlideProps) => {
    const { t } = useTranslation();

    return (
        <>
            <ArtPanel on={on}>
                {REMINDERS.map(item => (
                    <Reveal
                        key={item.key}
                        on={on}
                        delay={item.delay}
                        duration={600}
                        from={{ y: -22 }}
                        style={[styles.reminder, { top: item.top }]}
                    >
                        <Image source={VIVA_AVATAR} style={styles.reminderAvatar} />
                        <View style={styles.flex}>
                            <IntroText font="bold" size={11} lineHeight={1.27} color={INTRO_COLORS.muted} numberOfLines={1}>
                                {t('welcomeIntro.slide3.vivaName')} · {t(`welcomeIntro.slide5.${item.key}Time`)}
                            </IntroText>
                            <IntroText font="heading" size={15.5} lineHeight={1.25} numberOfLines={1}>
                                {t(`welcomeIntro.slide5.${item.key}Title`)}
                            </IntroText>
                            <IntroText size={13} color={INTRO_COLORS.muted} numberOfLines={1}>
                                {t(`welcomeIntro.slide5.${item.key}Detail`)}
                            </IntroText>
                        </View>
                    </Reveal>
                ))}
                <Reveal on={on} delay={850} style={styles.reminderGhost} />
                <Reveal
                    on={on}
                    delay={950}
                    duration={600}
                    easing={EASE_POP}
                    from={{ scale: 0.6, rotate: -40 }}
                    style={styles.bell}
                >
                    <LineIcon name="bell" size={20} color={INTRO_COLORS.white} weight={2.3} />
                </Reveal>
            </ArtPanel>
            <Caption on={on} title={t('welcomeIntro.slide5.title')} body={t('welcomeIntro.slide5.body')} />
        </>
    );
};

const ExpertPortrait = ({ xml, background, style }: { xml: string; background: string; style: ViewStyle }) => (
    <View style={[styles.expertRing, style]}>
        <View style={[styles.expertPhoto, { backgroundColor: background }]}>
            <SvgXml width={72} height={72} xml={xml} />
        </View>
    </View>
);

/** Slide 6: Sia connected, through care, to her doctor and a counsellor. */
export const CareTeamSlide = ({ on }: ISlideProps) => {
    const { t } = useTranslation();

    return (
        <>
            <ArtPanel on={on}>
                <Reveal on={on} delay={550} duration={400} style={StyleSheet.absoluteFill}>
                    <Svg width={358} height={432}>
                        <Path d="M179 128V154" stroke={INTRO_COLORS.lilac} strokeWidth={2} strokeDasharray="6 5" fill="none" />
                    </Svg>
                </Reveal>
                <Reveal on={on} delay={850} duration={400} style={StyleSheet.absoluteFill}>
                    <Svg width={358} height={432}>
                        <Path
                            d="M90 209V189A16 16 0 0 1 106 173H255A16 16 0 0 1 271 189V209"
                            stroke={INTRO_COLORS.lilac}
                            strokeWidth={2}
                            strokeDasharray="6 5"
                            fill="none"
                        />
                    </Svg>
                </Reveal>

                <Reveal on={on} delay={200} duration={550} {...POP} style={styles.siaFrame}>
                    <Image source={SIA_PHOTO} style={styles.siaPhoto} />
                </Reveal>
                <Reveal on={on} delay={350} duration={400} style={styles.siaName}>
                    <IntroText font="heading" size={15} style={styles.centered}>
                        {t('welcomeIntro.slide6.sia')}
                    </IntroText>
                </Reveal>
                <Reveal on={on} delay={700} duration={550} {...POP} style={styles.careHeart}>
                    <LineIcon name="heart" size={18} color={INTRO_COLORS.white} filled />
                </Reveal>

                <Reveal on={on} delay={1000} duration={550} {...POP} style={styles.doctorPosition}>
                    <ExpertPortrait xml={DOCTOR_PORTRAIT} background="#DCE6FA" style={styles.flex} />
                </Reveal>
                <Reveal on={on} delay={1150} duration={550} {...POP} style={styles.counsellorPosition}>
                    <ExpertPortrait xml={COUNSELLOR_PORTRAIT} background="#FFE9DC" style={styles.flex} />
                </Reveal>

                <Reveal on={on} delay={1100} duration={400} style={[styles.expertLabel, styles.leftColumn]}>
                    <IntroText font="heading" size={15} numberOfLines={2} style={styles.centered}>
                        {t('welcomeIntro.slide6.doctor')}
                    </IntroText>
                </Reveal>
                <Reveal on={on} delay={1250} duration={400} style={[styles.expertLabel, styles.rightColumn]}>
                    <IntroText font="heading" size={15} numberOfLines={2} style={styles.centered}>
                        {t('welcomeIntro.slide6.counsellor')}
                    </IntroText>
                </Reveal>

                <Reveal on={on} delay={1400} duration={600} from={{ y: 12 }} style={[styles.expertAction, styles.leftColumn]}>
                    <View style={styles.actionPill}>
                        <LineIcon name="video" size={16} color={INTRO_COLORS.purple} />
                        <IntroText font="semibold" size={13.5} color="#3D1A63" numberOfLines={1}>
                            {t('welcomeIntro.slide6.book')}
                        </IntroText>
                    </View>
                </Reveal>
                <Reveal on={on} delay={1550} duration={600} from={{ y: 12 }} style={[styles.expertAction, styles.rightColumn]}>
                    <View style={styles.actionPill}>
                        <LineIcon name="chat" size={16} color={INTRO_COLORS.purple} />
                        <IntroText font="semibold" size={13.5} color="#3D1A63" numberOfLines={1}>
                            {t('welcomeIntro.slide6.talk')}
                        </IntroText>
                    </View>
                </Reveal>
            </ArtPanel>
            <Caption on={on} title={t('welcomeIntro.slide6.title')} body={t('welcomeIntro.slide6.body')} />
        </>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    absolute: { position: 'absolute' },
    centered: { textAlign: 'center' },
    selfCenter: { alignSelf: 'center' },

    journeyDot: {
        position: 'absolute',
        top: 336,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: INTRO_COLORS.panel,
    },
    journeyNode: {
        position: 'absolute',
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 3,
        backgroundColor: INTRO_COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 20px rgba(104, 20, 219, 0.16)',
    },
    journeyDays: { position: 'absolute', left: 24, top: 352, width: 304 },

    chatCard: {
        position: 'absolute',
        left: 16,
        top: 16,
        width: 326,
        height: 400,
        borderRadius: 26,
        backgroundColor: INTRO_COLORS.white,
        overflow: 'hidden',
        boxShadow: '0 14px 34px rgba(31, 20, 51, 0.10)',
    },
    chatHeader: {
        height: 54,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EFE7FB',
    },
    chatHeaderAvatar: { width: 34, height: 34, borderRadius: 17 },
    chatBody: { flex: 1, minHeight: 0, paddingVertical: 12, paddingHorizontal: 14, gap: 10, overflow: 'hidden' },
    userMessage: {
        alignSelf: 'flex-end',
        maxWidth: 232,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 6,
        backgroundColor: INTRO_COLORS.userBubble,
    },
    vivaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: 298 },
    vivaRowAvatar: { width: 28, height: 28, borderRadius: 14 },
    typingBubble: {
        position: 'absolute',
        left: 36,
        top: 0,
        height: 38,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        backgroundColor: INTRO_COLORS.softBubble,
    },
    typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#9B78DE' },
    typingDotMid: { opacity: 0.7 },
    typingDotFaint: { opacity: 0.45 },
    vivaMessage: {
        flex: 1,
        minWidth: 0,
        paddingTop: 10,
        paddingHorizontal: 14,
        paddingBottom: 12,
        gap: 4,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        backgroundColor: INTRO_COLORS.softBubble,
    },
    verifiedRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 7, transformOrigin: ['0%', '50%', 0] },
    verifiedMark: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: INTRO_COLORS.amber,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatInput: {
        marginHorizontal: 12,
        marginBottom: 12,
        height: 44,
        paddingLeft: 16,
        paddingRight: 6,
        borderRadius: 22,
        backgroundColor: INTRO_COLORS.softBubble,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    chatInputButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    chatInputMic: { backgroundColor: INTRO_COLORS.tint },
    chatInputSend: { backgroundColor: INTRO_COLORS.purple },

    phone: {
        position: 'absolute',
        left: 57,
        top: 28,
        width: 244,
        height: 430,
        paddingTop: 7,
        paddingHorizontal: 7,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        backgroundColor: '#2A1F3D',
        boxShadow: '0 18px 40px rgba(31, 20, 51, 0.22)',
    },
    phoneScreen: {
        width: 230,
        height: 423,
        paddingTop: 22,
        paddingHorizontal: 12,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        backgroundColor: INTRO_COLORS.page,
        overflow: 'hidden',
        gap: 8,
    },
    phoneSpeaker: {
        position: 'absolute',
        left: 95,
        top: 8,
        width: 40,
        height: 5,
        borderRadius: 3,
        backgroundColor: INTRO_COLORS.track,
    },
    phoneHeader: { height: 30, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 8 },
    phoneHeaderPhoto: { width: 28, height: 28, borderRadius: 14 },
    reportRow: {
        height: 58,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: INTRO_COLORS.white,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 4px 12px rgba(31, 20, 51, 0.07)',
    },
    reportIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: INTRO_COLORS.panel,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryRow: {
        height: 50,
        paddingLeft: 12,
        paddingRight: 8,
        borderRadius: 14,
        backgroundColor: INTRO_COLORS.tint,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    summaryIcon: {
        width: 30,
        height: 30,
        borderRadius: 9,
        backgroundColor: INTRO_COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addRow: {
        height: 50,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#CDB8F5',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    addIcon: {
        width: 30,
        height: 30,
        borderRadius: 9,
        backgroundColor: INTRO_COLORS.purple,
        alignItems: 'center',
        justifyContent: 'center',
    },

    reminder: {
        position: 'absolute',
        left: 16,
        width: 326,
        height: 82,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: INTRO_COLORS.white,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 10px 24px rgba(31, 20, 51, 0.08)',
    },
    reminderAvatar: { width: 38, height: 38, borderRadius: 19 },
    reminderGhost: {
        position: 'absolute',
        left: 34,
        top: 332,
        width: 290,
        height: 50,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.55)',
    },
    bell: {
        position: 'absolute',
        left: 304,
        top: 30,
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 4,
        borderColor: INTRO_COLORS.panel,
        backgroundColor: INTRO_COLORS.amber,
        alignItems: 'center',
        justifyContent: 'center',
    },

    siaFrame: {
        position: 'absolute',
        left: 143,
        top: 24,
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: INTRO_COLORS.white,
        overflow: 'hidden',
    },
    siaPhoto: { width: 64, height: 64 },
    siaName: { position: 'absolute', left: 119, top: 102, width: 120 },
    careHeart: {
        position: 'absolute',
        left: 154,
        top: 149,
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 5,
        borderColor: INTRO_COLORS.panel,
        backgroundColor: INTRO_COLORS.purple,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doctorPosition: { position: 'absolute', left: 47, top: 206, width: 86, height: 86 },
    counsellorPosition: { position: 'absolute', left: 227, top: 206, width: 86, height: 86 },
    expertRing: {
        borderRadius: 43,
        backgroundColor: INTRO_COLORS.purple,
        alignItems: 'center',
        justifyContent: 'center',
    },
    expertPhoto: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: INTRO_COLORS.white,
        overflow: 'hidden',
    },
    expertLabel: { position: 'absolute', top: 298, width: 160 },
    leftColumn: { left: 10 },
    rightColumn: { left: 188 },
    expertAction: { position: 'absolute', top: 370, width: 160, alignItems: 'center' },
    actionPill: {
        height: 40,
        paddingLeft: 12,
        paddingRight: 14,
        borderRadius: 20,
        backgroundColor: INTRO_COLORS.white,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 6px 16px rgba(31, 20, 51, 0.08)',
    },
});
