import React, { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    GestureResponderEvent,
    Image,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Video, { OnLoadData, OnProgressData, VideoRef } from 'react-native-video';

import { AnalyticsEvent, recordError, track } from '../../analytics';
import { JOURNEY_VIDEOS, JourneyVideoKind } from '../../data/journeyVideos';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { formatVideoClock } from '../../utils/journeyVideo';

type Phase = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'failed';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * A Journey clip with only the controls it needs: play or pause, a seek bar, and the time.
 * The player is not mounted until the first tap, so scrolling past costs no data. The clips
 * have no audio track, so there is no mute button, and the player is told to leave any
 * music she has playing alone.
 */
const JourneyVideo: React.FC<{ kind: JourneyVideoKind }> = ({ kind }) => {
    const { t } = useTranslation();
    const isFocused = useIsFocused();
    const video = JOURNEY_VIDEOS[kind];
    const player = useRef<VideoRef>(null);

    const [phase, setPhase] = useState<Phase>('idle');
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [scrub, setScrub] = useState<number | null>(null);

    const barWidth = useRef(0);
    const dragStartX = useRef(0);
    const durationRef = useRef(0);

    const shownFraction = scrub ?? (duration > 0 ? clamp01(position / duration) : 0);
    const showPlayer = phase !== 'idle' && phase !== 'failed';

    const seekTo = (fraction: number) => {
        const seconds = fraction * durationRef.current;
        setPosition(seconds);
        player.current?.seek(seconds);
        setPhase(current => (current === 'ended' ? 'paused' : current));
    };
    const seekToRef = useRef(seekTo);
    seekToRef.current = seekTo;

    // A responder rather than a gesture handler: it claims the touch from the card rail's
    // horizontal scroll, so dragging the bar scrubs instead of swiping to the next card.
    const scrubber = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => durationRef.current > 0,
                onMoveShouldSetPanResponder: () => durationRef.current > 0,
                onPanResponderTerminationRequest: () => false,
                onShouldBlockNativeResponder: () => true,
                onPanResponderGrant: (event: GestureResponderEvent) => {
                    dragStartX.current = event.nativeEvent.locationX;
                    setScrub(clamp01(dragStartX.current / (barWidth.current || 1)));
                },
                onPanResponderMove: (_, gesture) => {
                    setScrub(clamp01((dragStartX.current + gesture.dx) / (barWidth.current || 1)));
                },
                onPanResponderRelease: (_, gesture) => {
                    seekToRef.current(clamp01((dragStartX.current + gesture.dx) / (barWidth.current || 1)));
                    setScrub(null);
                },
                onPanResponderTerminate: () => setScrub(null),
            }),
        [],
    );

    const togglePlay = () => {
        if (phase === 'idle' || phase === 'failed') {
            track(AnalyticsEvent.VIDEO_STARTED, { content_id: video.contentId });
            setPhase('loading');
        } else if (phase === 'ended') {
            track(AnalyticsEvent.VIDEO_STARTED, { content_id: video.contentId });
            player.current?.seek(0);
            setPosition(0);
            setPhase('playing');
        } else if (phase === 'playing') {
            setPhase('paused');
        } else if (phase === 'paused') {
            setPhase('playing');
        }
    };

    const onLoad = (data: OnLoadData) => {
        durationRef.current = data.duration;
        setDuration(data.duration);
        setPhase(current => (current === 'loading' ? 'playing' : current));
    };

    const onProgress = (data: OnProgressData) => setPosition(data.currentTime);

    const onEnd = () => {
        track(AnalyticsEvent.VIDEO_COMPLETED, { content_id: video.contentId });
        setPosition(durationRef.current);
        setPhase('ended');
    };

    const onError = (error: unknown) => {
        recordError(error, `JourneyVideo.${kind}`);
        setPhase('failed');
    };

    const isPlaying = phase === 'playing';
    const isLoading = phase === 'loading';
    const showCentreButton = phase === 'idle' || phase === 'failed' || phase === 'ended';
    const hasControls = phase === 'playing' || phase === 'paused' || phase === 'ended';

    const playLabel = phase === 'failed' ? t('journey.video.retry') : t('journey.video.play');

    return (
        <View style={StyleSheet.absoluteFill}>
            <Image source={video.poster} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors />

            {showPlayer ? (
                <Video
                    ref={player}
                    source={{ uri: video.uri }}
                    style={styles.fill}
                    resizeMode="cover"
                    controls={false}
                    muted
                    disableFocus
                    mixWithOthers="mix"
                    paused={!isPlaying || !isFocused}
                    progressUpdateInterval={250}
                    onLoad={onLoad}
                    onProgress={onProgress}
                    onEnd={onEnd}
                    onError={onError}
                />
            ) : null}

            {isLoading ? (
                <View style={styles.centre} pointerEvents="none">
                    <ActivityIndicator color={colors.white} accessibilityLabel={t('journey.video.loading')} />
                </View>
            ) : null}

            {showCentreButton ? (
                <Pressable
                    style={styles.centre}
                    onPress={togglePlay}
                    accessibilityRole="button"
                    accessibilityLabel={phase === 'ended' ? t('journey.video.replay') : playLabel}
                >
                    <View style={styles.centreButton}>
                        <Lucide
                            name={phase === 'ended' ? 'rotate-ccw' : phase === 'failed' ? 'refresh-cw' : 'play'}
                            size={24}
                            color={colors.white}
                        />
                    </View>
                    {phase === 'failed' ? (
                        <Text style={[styles.failedText, globalStyles.fontSemiBold]}>{t('journey.video.failed')}</Text>
                    ) : null}
                </Pressable>
            ) : null}

            {hasControls ? (
                <View style={styles.controls}>
                    <Pressable
                        onPress={togglePlay}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t(isPlaying ? 'journey.video.pause' : 'journey.video.play')}
                    >
                        <Lucide name={isPlaying ? 'pause' : 'play'} size={18} color={colors.white} />
                    </Pressable>

                    <View
                        style={styles.bar}
                        onLayout={event => {
                            barWidth.current = event.nativeEvent.layout.width;
                        }}
                        accessible
                        accessibilityRole="adjustable"
                        accessibilityLabel={t('journey.video.seek')}
                        accessibilityValue={{ text: formatVideoClock(position) }}
                        {...scrubber.panHandlers}
                    >
                        <View style={styles.track} pointerEvents="none">
                            <View style={[styles.trackFill, { width: `${shownFraction * 100}%` }]} />
                        </View>
                        <View style={[styles.thumb, { left: `${shownFraction * 100}%` }]} pointerEvents="none" />
                    </View>

                    <Text style={[styles.time, globalStyles.fontMedium]}>
                        {formatVideoClock(scrub !== null ? scrub * duration : position)} / {formatVideoClock(duration)}
                    </Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    fill: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    centre: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    centreButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(31, 20, 51, 0.6)',
    },
    failedText: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
        overflow: 'hidden',
        fontSize: 12,
        color: colors.white,
        backgroundColor: 'rgba(31, 20, 51, 0.6)',
    },
    controls: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 40,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(31, 20, 51, 0.55)',
    },
    // Taller than it looks, so the thin line is still easy to grab.
    bar: {
        flex: 1,
        height: 40,
        justifyContent: 'center',
    },
    track: {
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    trackFill: {
        height: 3,
        backgroundColor: colors.white,
    },
    thumb: {
        position: 'absolute',
        top: 14,
        width: 12,
        height: 12,
        marginLeft: -6,
        borderRadius: 6,
        backgroundColor: colors.white,
    },
    time: {
        fontSize: 11,
        color: colors.white,
    },
});

export default JourneyVideo;
