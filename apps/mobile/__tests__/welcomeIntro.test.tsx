import React from 'react';
import { BackHandler, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';

import en from '../src/i18n/locales/en.json';
import hi from '../src/i18n/locales/hi.json';
import i18n from '../src/i18n';
import { track } from '../src/analytics';
import { AuthProvider, useAuth, WELCOME_INTRO_STORAGE_KEY } from '../src/context/AuthContext';
import AuthStack from '../src/navigators/stacks/AuthStack';
import WelcomeIntro from '../src/screens/WelcomeIntro';
import { splitGraphemes } from '../src/utils/graphemes';
import { fitArtScale, resolveSwipe } from '../src/utils/welcomeIntro';

const mockMarkSeen = jest.fn(() => Promise.resolve());
const mockSetLanguage = jest.fn(() => Promise.resolve());
let mockHasSeen = false;
let mockLanguage = 'en';

jest.mock('react-native-safe-area-context', () => {
    const actual = jest.requireActual('react-native-safe-area-context');
    return { ...actual, useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) };
});

jest.mock('../src/context/LanguageContext', () => ({
    useLanguage: () => ({
        language: mockLanguage,
        setLanguage: mockSetLanguage,
        hasSelectedLanguage: false,
        isLanguageReady: true,
    }),
}));

jest.mock('../src/analytics', () => ({
    AnalyticsEvent: {
        WELCOME_INTRO_SLIDE_VIEWED: 'welcome_intro_slide_viewed',
        WELCOME_INTRO_SKIPPED: 'welcome_intro_skipped',
        WELCOME_INTRO_COMPLETED: 'welcome_intro_completed',
    },
    UserProperty: {},
    track: jest.fn(),
    identify: jest.fn(),
    clearIdentity: jest.fn(),
    recordError: jest.fn(),
    setUserProps: jest.fn(),
    resolveOnboardingStage: jest.fn(),
}));

jest.mock('../src/context/AuthContext', () => ({
    ...jest.requireActual('../src/context/AuthContext'),
    useAuth: jest.fn(),
}));

jest.mock('../src/screens/Landing', () => {
    const { Text: MockText } = require('react-native');
    return () => <MockText>LANDING_SCREEN</MockText>;
});
jest.mock('../src/screens/LoginwithPhone', () => () => null);

// GestureDetector needs Reanimated's native event hook. The stub keeps hold of the real
// gesture object, so the swipe tests below can drive the screen's actual handlers.
let mockPanGesture: any = null;
jest.mock('react-native-gesture-handler', () => ({
    ...jest.requireActual('react-native-gesture-handler'),
    GestureDetector: ({ gesture, children }: any) => {
        mockPanGesture = gesture;
        return children;
    },
}));

jest.mock('@react-native-firebase/messaging', () => ({
    __esModule: true,
    getMessaging: () => ({ onTokenRefresh: () => () => undefined }),
    default: () => ({}),
}));
jest.mock('../src/utils/getFCMToken', () => ({ getFCMToken: jest.fn(() => Promise.resolve('token')) }));
jest.mock('../src/utils/notificationPermission', () => ({
    ensureNotificationPermission: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('../src/utils/syncUserData', () => ({ syncUserData: jest.fn(() => Promise.resolve()) }));
jest.mock('../src/db/sqlite', () => ({ chatDB: { clearChatHistoryV2: jest.fn(() => Promise.resolve()) } }));

const renderIntro = () => {
    const navigation = { replace: jest.fn() };
    render(<WelcomeIntro navigation={navigation} />);
    return navigation;
};

const pressNext = () => fireEvent.press(screen.getByLabelText(en.welcomeIntro.next));

const swipe = (translationX: number, velocityX = 0) => {
    act(() => {
        mockPanGesture.handlers.onEnd({ translationX, velocityX });
    });
};

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockHasSeen = false;
    mockLanguage = 'en';
    (useAuth as jest.Mock).mockImplementation(() => ({
        hasSeenWelcomeIntro: mockHasSeen,
        markWelcomeIntroSeen: mockMarkSeen,
    }));
});

afterEach(() => {
    act(() => {
        jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
});

describe('the WelcomeIntro screen', () => {
    it('steps through all seven slides and ends on Let’s begin', () => {
        renderIntro();
        expect(screen.queryByLabelText(en.welcomeIntro.begin)).toBeNull();

        for (let step = 0; step < 6; step += 1) {
            pressNext();
        }

        expect(screen.getByLabelText(en.welcomeIntro.begin)).toBeTruthy();
        expect(screen.queryByLabelText(en.welcomeIntro.next)).toBeNull();
        expect(screen.queryByText(en.welcomeIntro.skip)).toBeNull();
    });

    it('jumps to the promise slide on Skip rather than leaving the intro', () => {
        const navigation = renderIntro();

        fireEvent.press(screen.getByText(en.welcomeIntro.skip));

        expect(screen.getByLabelText(en.welcomeIntro.begin)).toBeTruthy();
        expect(navigation.replace).not.toHaveBeenCalled();
        expect(mockMarkSeen).not.toHaveBeenCalled();
        expect(track).toHaveBeenCalledWith('welcome_intro_skipped', { slide_number: 1 });
    });

    it('saves the flag and only then replaces itself with Landing', async () => {
        const navigation = renderIntro();
        fireEvent.press(screen.getByText(en.welcomeIntro.skip));

        fireEvent.press(screen.getByLabelText(en.welcomeIntro.begin));

        await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Landing'));
        expect(mockMarkSeen).toHaveBeenCalledTimes(1);
        expect(mockMarkSeen.mock.invocationCallOrder[0]).toBeLessThan(
            navigation.replace.mock.invocationCallOrder[0],
        );
        expect(track).toHaveBeenCalledWith('welcome_intro_completed');
    });

    it('does not navigate twice on a double tap', async () => {
        const navigation = renderIntro();
        fireEvent.press(screen.getByText(en.welcomeIntro.skip));
        const begin = screen.getByLabelText(en.welcomeIntro.begin);

        fireEvent.press(begin);
        fireEvent.press(begin);

        await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
    });

    it('does not save the flag if the intro is abandoned part-way', () => {
        renderIntro();
        pressNext();
        pressNext();
        screen.unmount();

        expect(mockMarkSeen).not.toHaveBeenCalled();
    });

    it('offers the other language on slide 1 only, in place of the back button', () => {
        renderIntro();

        fireEvent.press(screen.getByText('हिन्दी'));
        expect(mockSetLanguage).toHaveBeenCalledWith('hi');
        expect(screen.queryByLabelText(en.welcomeIntro.back)).toBeNull();

        pressNext();
        expect(screen.queryByText('हिन्दी')).toBeNull();
        expect(screen.getByLabelText(en.welcomeIntro.back)).toBeTruthy();
    });

    it('logs each slide once, even when revisited', () => {
        renderIntro();
        pressNext();
        fireEvent.press(screen.getByLabelText(en.welcomeIntro.back));
        pressNext();

        const views = (track as jest.Mock).mock.calls.filter(([name]) => name === 'welcome_intro_slide_viewed');
        expect(views).toEqual([
            ['welcome_intro_slide_viewed', { slide_number: 1 }],
            ['welcome_intro_slide_viewed', { slide_number: 2 }],
        ]);
    });

    it('steps back with the Android back button, and lets it exit from slide 1', () => {
        const listeners: Array<() => boolean> = [];
        const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
            listeners.push(handler as () => boolean);
            return { remove: jest.fn() } as any;
        });

        renderIntro();
        const onBack = () => listeners[listeners.length - 1]();

        expect(onBack()).toBe(false);

        pressNext();
        let handled = false;
        act(() => {
            handled = onBack();
        });
        expect(handled).toBe(true);
        expect(screen.getByText('हिन्दी')).toBeTruthy();

        spy.mockRestore();
    });

    it('moves between slides on a swipe, and snaps back on a short one', () => {
        renderIntro();

        swipe(-20);
        expect(screen.getByText('हिन्दी')).toBeTruthy();

        swipe(-80);
        expect(screen.queryByText('हिन्दी')).toBeNull();
        expect(screen.getByLabelText(en.welcomeIntro.back)).toBeTruthy();

        swipe(80);
        expect(screen.getByText('हिन्दी')).toBeTruthy();

        swipe(80);
        expect(screen.getByText('हिन्दी')).toBeTruthy();
    });

    it('renders every slide in Hindi without missing a key', async () => {
        mockLanguage = 'hi';
        await act(async () => {
            await i18n.changeLanguage('hi');
        });

        renderIntro();
        act(() => {
            jest.advanceTimersByTime(500);
        });

        // Off-screen slides are hidden from screen readers, and so from the default query.
        const everywhere = { includeHiddenElements: true };
        expect(screen.getByText(hi.welcomeIntro.slide6.doctor, everywhere)).toBeTruthy();
        expect(screen.queryByText(/welcomeIntro\./, everywhere)).toBeNull();

        await act(async () => {
            await i18n.changeLanguage('en');
        });
    });

    it('types Viva’s greeting into the bubble without moving the rest of the text', () => {
        renderIntro();
        const greeting = `${en.welcomeIntro.slide1.bubbleBefore}${en.welcomeIntro.slide1.bubbleName}${en.welcomeIntro.slide1.bubbleAfter}`;

        expect(screen.getByLabelText(greeting)).toBeTruthy();

        act(() => {
            jest.advanceTimersByTime(150 + 750 + 40 * greeting.length + 100);
        });
        expect(screen.getByLabelText(greeting)).toHaveTextContent(greeting);
    });
});

describe('the AuthStack entry point', () => {
    const renderStack = () =>
        render(
            <NavigationContainer>
                <AuthStack />
            </NavigationContainer>,
        );

    it('opens on the intro for a device that has not seen it', () => {
        renderStack();
        expect(screen.queryByText('LANDING_SCREEN')).toBeNull();
        expect(screen.getByText(en.welcomeIntro.skip)).toBeTruthy();
    });

    it('opens on Landing once the device has seen it', () => {
        mockHasSeen = true;
        renderStack();
        expect(screen.getByText('LANDING_SCREEN')).toBeTruthy();
        expect(screen.queryByText(en.welcomeIntro.skip)).toBeNull();
    });
});

describe('the seen flag in AuthProvider', () => {
    const realUseAuth = jest.requireActual('../src/context/AuthContext').useAuth;

    const Probe = () => {
        const { isLoading, hasSeenWelcomeIntro, signOut } = realUseAuth();
        return (
            <>
                <Text>{isLoading ? 'loading' : `seen:${hasSeenWelcomeIntro}`}</Text>
                <Text onPress={signOut}>signOut</Text>
            </>
        );
    };

    const renderProvider = async () => {
        render(
            <AuthProvider>
                <Probe />
            </AuthProvider>,
        );
        await act(async () => {
            await jest.runOnlyPendingTimersAsync();
        });
    };

    const seedStorage = (values: Record<string, string>) => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
            Promise.resolve(values[key] ?? null),
        );
    };

    beforeEach(() => {
        (AsyncStorage.setItem as jest.Mock).mockClear();
        (AsyncStorage.removeItem as jest.Mock).mockClear();
    });

    it('treats a fresh install as not having seen it', async () => {
        seedStorage({});
        await renderProvider();
        expect(screen.getByText('seen:false')).toBeTruthy();
        expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(WELCOME_INTRO_STORAGE_KEY, 'true');
    });

    it('remembers it across launches', async () => {
        seedStorage({ [WELCOME_INTRO_STORAGE_KEY]: 'true' });
        await renderProvider();
        expect(screen.getByText('seen:true')).toBeTruthy();
    });

    it('marks an already logged-in user as seen, so they skip it after a later sign-out', async () => {
        seedStorage({ userToken: 'header.e30.signature' });
        await renderProvider();
        expect(screen.getByText('seen:true')).toBeTruthy();
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(WELCOME_INTRO_STORAGE_KEY, 'true');
    });

    it('goes to Landing rather than blocking login when the flag cannot be read', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
            key === WELCOME_INTRO_STORAGE_KEY ? Promise.reject(new Error('storage down')) : Promise.resolve(null),
        );
        await renderProvider();
        expect(screen.getByText('seen:true')).toBeTruthy();
    });

    it('keeps the flag through sign-out', async () => {
        seedStorage({ [WELCOME_INTRO_STORAGE_KEY]: 'true' });
        await renderProvider();

        await act(async () => {
            fireEvent.press(screen.getByText('signOut'));
            await jest.runOnlyPendingTimersAsync();
        });

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userToken');
        expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(WELCOME_INTRO_STORAGE_KEY);
        expect(screen.getByText('seen:true')).toBeTruthy();
    });
});

describe('splitGraphemes', () => {
    it('keeps Hindi matras and conjuncts whole', () => {
        expect(splitGraphemes('माँ')).toEqual(['माँ']);
        expect(splitGraphemes('क्ष')).toEqual(['क्ष']);
        expect(splitGraphemes('स्वास्थ्य')).toEqual(['स्वा', 'स्थ्य']);
    });

    it('splits Latin text letter by letter and loses nothing', () => {
        expect(splitGraphemes('Viva')).toEqual(['V', 'i', 'v', 'a']);
        const sentence = 'चलिए, आपका सेटअप शुरू करते हैं।';
        expect(splitGraphemes(sentence).join('')).toBe(sentence);
    });
});

describe('resolveSwipe', () => {
    it('turns the page on a long drag or a quick flick', () => {
        expect(resolveSwipe(-60, 0, 2, 6)).toBe(3);
        expect(resolveSwipe(60, 0, 2, 6)).toBe(1);
        expect(resolveSwipe(-20, -900, 2, 6)).toBe(3);
        expect(resolveSwipe(20, 900, 2, 6)).toBe(1);
    });

    it('snaps back on a short slow drag, and stops at both ends', () => {
        expect(resolveSwipe(-30, -100, 2, 6)).toBe(2);
        expect(resolveSwipe(200, 0, 0, 6)).toBe(0);
        expect(resolveSwipe(-200, 0, 6, 6)).toBe(6);
    });
});

describe('fitArtScale', () => {
    it('fits the design on a phone of the size it was drawn for', () => {
        expect(fitArtScale(390, 616)).toBe(1);
    });

    it('shrinks on small phones, whichever dimension runs out first', () => {
        expect(fitArtScale(360, 700)).toBeCloseTo(360 / 390);
        expect(fitArtScale(360, 464)).toBeCloseTo(464 / 616);
    });

    it('stops growing on tablets', () => {
        expect(fitArtScale(800, 1200)).toBe(1.25);
    });
});

describe('the welcome intro copy', () => {
    const keysOf = (node: object, prefix = ''): string[] =>
        Object.entries(node).flatMap(([key, value]) =>
            typeof value === 'object' ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`],
        );

    it('has the same keys in English and Hindi', () => {
        expect(keysOf(hi.welcomeIntro)).toEqual(keysOf(en.welcomeIntro));
    });
});
