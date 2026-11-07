import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import en from '../src/i18n/locales/en.json';
import hi from '../src/i18n/locales/hi.json';
import { track } from '../src/analytics';
import JourneyVideo from '../src/components/journey/JourneyVideo';
import { JOURNEY_VIDEOS } from '../src/data/journeyVideos';
import { formatVideoClock } from '../src/utils/journeyVideo';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
    useIsFocused: () => mockFocused,
}));

jest.mock('../src/analytics', () => ({
    AnalyticsEvent: { VIDEO_STARTED: 'video_started', VIDEO_COMPLETED: 'video_completed' },
    track: jest.fn(),
    recordError: jest.fn(),
}));

const labels = en.journey.video;
const player = () => screen.getByTestId('journey-video-player');
const { seek } = jest.requireMock('react-native-video');

const startPlaying = () => {
    fireEvent.press(screen.getByLabelText(labels.play));
    act(() => {
        player().props.onLoad({ duration: 35 });
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
});

describe('JourneyVideo', () => {
    it('downloads nothing until it is tapped', () => {
        render(<JourneyVideo kind="mother" />);
        expect(screen.queryByTestId('journey-video-player')).toBeNull();
        expect(track).not.toHaveBeenCalled();
    });

    it('plays the right clip from the CDN once tapped, with native controls off', () => {
        render(<JourneyVideo kind="baby" />);
        startPlaying();

        expect(player().props.source).toEqual({ uri: JOURNEY_VIDEOS.baby.uri });
        expect(JOURNEY_VIDEOS.baby.uri).toMatch(/^https:\/\/assets\.vivamama\.in\//);
        expect(player().props.controls).toBe(false);
        expect(player().props.paused).toBe(false);
        expect(track).toHaveBeenCalledWith('video_started', { content_id: 'journey_baby' });
    });

    it('leaves other audio alone, since the clips are silent', () => {
        render(<JourneyVideo kind="mother" />);
        startPlaying();
        expect(player().props.muted).toBe(true);
        expect(player().props.disableFocus).toBe(true);
    });

    it('pauses and resumes from its control', () => {
        render(<JourneyVideo kind="mother" />);
        startPlaying();

        fireEvent.press(screen.getByLabelText(labels.pause));
        expect(player().props.paused).toBe(true);

        fireEvent.press(screen.getByLabelText(labels.play));
        expect(player().props.paused).toBe(false);
    });

    it('stops playing when she leaves the tab', () => {
        render(<JourneyVideo kind="mother" />);
        startPlaying();

        mockFocused = false;
        screen.rerender(<JourneyVideo kind="mother" />);

        expect(player().props.paused).toBe(true);
    });

    it('shows the time as it plays', () => {
        render(<JourneyVideo kind="mother" />);
        startPlaying();

        act(() => {
            player().props.onProgress({ currentTime: 12.4 });
        });

        expect(screen.getByText('0:12 / 0:35')).toBeTruthy();
    });

    it('offers a replay at the end, which restarts from the beginning', () => {
        render(<JourneyVideo kind="mother" />);
        startPlaying();

        act(() => {
            player().props.onEnd();
        });
        expect(track).toHaveBeenCalledWith('video_completed', { content_id: 'journey_mother' });
        expect(player().props.paused).toBe(true);

        fireEvent.press(screen.getByLabelText(labels.replay));
        expect(seek).toHaveBeenCalledWith(0);
        expect(player().props.paused).toBe(false);
    });

    it('falls back to the poster with a retry when the video will not load', () => {
        render(<JourneyVideo kind="mother" />);
        fireEvent.press(screen.getByLabelText(labels.play));

        act(() => {
            player().props.onError({ error: 'network' });
        });

        expect(screen.queryByTestId('journey-video-player')).toBeNull();
        expect(screen.getByText(labels.failed)).toBeTruthy();

        fireEvent.press(screen.getByLabelText(labels.retry));
        expect(player()).toBeTruthy();
    });
});

describe('formatVideoClock', () => {
    it('reads as m:ss', () => {
        expect(formatVideoClock(0)).toBe('0:00');
        expect(formatVideoClock(35.29)).toBe('0:35');
        expect(formatVideoClock(65)).toBe('1:05');
    });

    it('never shows a broken time', () => {
        expect(formatVideoClock(NaN)).toBe('0:00');
        expect(formatVideoClock(-3)).toBe('0:00');
    });
});

describe('the video strings', () => {
    it('are translated', () => {
        expect(Object.keys(hi.journey.video)).toEqual(Object.keys(en.journey.video));
    });
});
