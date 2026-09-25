/**
 * The edit-child screen, and mostly the things it refuses to do.
 *
 * The screen is small on purpose: a child's date of birth, sex and vaccination sector are
 * set at baby onboarding and frozen after, because everything derived about the child is
 * computed from them. What is worth pinning here is that the freeze is visible — the fields
 * are shown, not hidden — and that the delete says what it destroys before it destroys it.
 *
 * Run:  npx jest editChild
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import '../src/i18n';
import EditChild from '../src/screens/EditChild';

let mockRouteParams: Record<string, unknown> = {};
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: mockRouteParams }),
    useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
    useFocusEffect: (effect: () => void | (() => void)) =>
        require('react').useEffect(effect, [effect]),
}));

jest.mock('react-native-safe-area-context', () => {
    const { View } = require('react-native');
    return {
        SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
        SafeAreaProvider: ({ children }: any) => <>{children}</>,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

const { updateChild, deleteChild } = require('../src/api/child.api');

jest.mock('../src/api/child.api', () => ({
    updateChild: jest.fn().mockResolvedValue(undefined),
    deleteChild: jest.fn().mockResolvedValue(undefined),
}));

const BASE = {
    childId: 'child-1',
    childName: 'Aarav',
    childDob: '2026-03-14T06:00:00.000Z',
    childSex: 'Male' as const,
    vaccinationSector: 'private' as const,
    birthMeasurements: { weight_grams: 3250, length_cm: 50.5 },
};

beforeEach(() => {
    mockRouteParams = { ...BASE };
    updateChild.mockClear();
    deleteChild.mockClear();
    mockGoBack.mockClear();
    updateChild.mockResolvedValue(undefined);
    deleteChild.mockResolvedValue(undefined);
});

describe('what can be changed', () => {
    it('opens on what the child already has', () => {
        const { getByLabelText } = render(<EditChild />);

        expect(getByLabelText('Name').props.value).toBe('Aarav');
        expect(getByLabelText('Weight at birth').props.value).toBe('3250');
        expect(getByLabelText('Length at birth').props.value).toBe('50.5');
        // Not recorded at onboarding, and an empty box is not a zero.
        expect(getByLabelText('Head circumference at birth').props.value).toBe('');
    });

    it('sends the name and only the measurements that were filled in', async () => {
        const { getByLabelText, getByText } = render(<EditChild />);

        fireEvent.changeText(getByLabelText('Name'), 'Aarav Kumar');
        fireEvent.press(getByText('Save changes'));

        await waitFor(() => expect(updateChild).toHaveBeenCalled());
        expect(updateChild).toHaveBeenCalledWith('child-1', {
            name: 'Aarav Kumar',
            birth_measurements: { weight_grams: 3250, length_cm: 50.5 },
        });
        expect(mockGoBack).toHaveBeenCalled();
    });

    it('refuses a blank name rather than sending one', async () => {
        const { getByLabelText, getByText } = render(<EditChild />);

        fireEvent.changeText(getByLabelText('Name'), '   ');
        fireEvent.press(getByText('Save changes'));

        expect(updateChild).not.toHaveBeenCalled();
    });

    /**
     * The API drops an out-of-range measurement without complaining, so catching it here is
     * what turns a silently lost edit into a fixable one.
     */
    it('will not send a measurement outside the range the API accepts', async () => {
        const { getByLabelText, getByText } = render(<EditChild />);

        fireEvent.changeText(getByLabelText('Weight at birth'), '99999');

        expect(getByText('Enter a value between 500 and 8000')).toBeTruthy();

        fireEvent.press(getByText('Save changes'));
        expect(updateChild).not.toHaveBeenCalled();
    });
});

describe('what cannot be changed', () => {
    /**
     * Shown rather than hidden. A field a mother cannot find reads as missing; one she can
     * see and cannot change reads as decided.
     */
    it('shows the frozen fields as read-only, and says why', () => {
        const { getByText, queryByLabelText } = render(<EditChild />);

        expect(getByText('Set when you added your baby')).toBeTruthy();
        expect(getByText('14 Mar 2026')).toBeTruthy();
        expect(getByText('Boy')).toBeTruthy();
        expect(getByText('Private sector schedule')).toBeTruthy();

        // No input for any of them.
        expect(queryByLabelText('Date of birth')).toBeNull();
        expect(queryByLabelText('Sex')).toBeNull();
        expect(queryByLabelText('Vaccination schedule')).toBeNull();
    });

    it('never sends a frozen field, whatever is in the route params', async () => {
        const { getByText } = render(<EditChild />);

        fireEvent.press(getByText('Save changes'));

        await waitFor(() => expect(updateChild).toHaveBeenCalled());

        const payload = updateChild.mock.calls[0][1];
        expect(payload).not.toHaveProperty('date_of_birth');
        expect(payload).not.toHaveProperty('sex');
        expect(payload).not.toHaveProperty('vaccination_sector');
    });

    it('points at the only way to correct one', () => {
        const { getByText } = render(<EditChild />);

        expect(
            getByText(
                'To correct a date of birth, sex or vaccination schedule, remove your baby and add them again.',
            ),
        ).toBeTruthy();
    });
});

describe('removing a child', () => {
    /**
     * With the three fields above frozen, this is the only way to correct one — so the
     * mother most likely to reach it is one fixing a typo, the single person who does not
     * expect to lose anything. The confirmation has to name what goes.
     */
    it('names what is about to be destroyed, and waits', () => {
        const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

        const { getByText } = render(<EditChild />);
        fireEvent.press(getByText('Remove Aarav'));

        expect(spy).toHaveBeenCalled();
        const [title, body] = spy.mock.calls[0];
        expect(title).toBe('Remove Aarav?');
        expect(body).toContain('growth measurements, feeds, nappy changes, milestones and vaccinations');
        expect(body).toContain('cannot be undone');

        // Nothing has happened yet — the tap opened a question, not a deletion.
        expect(deleteChild).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('deletes only once the destructive choice is taken', async () => {
        const spy = jest
            .spyOn(Alert, 'alert')
            .mockImplementation((_title, _body, buttons) => {
                const destructive = (buttons ?? []).find(
                    (button: any) => button.style === 'destructive',
                );
                destructive?.onPress?.();
            });

        const { getByText } = render(<EditChild />);
        fireEvent.press(getByText('Remove Aarav'));

        await waitFor(() => expect(deleteChild).toHaveBeenCalledWith('child-1'));
        expect(mockGoBack).toHaveBeenCalled();

        spy.mockRestore();
    });

    it('stays put when the delete fails', async () => {
        deleteChild.mockRejectedValue(new Error('offline'));

        const spy = jest
            .spyOn(Alert, 'alert')
            .mockImplementation((_title, _body, buttons) => {
                const destructive = (buttons ?? []).find(
                    (button: any) => button.style === 'destructive',
                );
                destructive?.onPress?.();
            });

        const { getByText } = render(<EditChild />);
        fireEvent.press(getByText('Remove Aarav'));

        await waitFor(() => expect(deleteChild).toHaveBeenCalled());
        expect(mockGoBack).not.toHaveBeenCalled();

        spy.mockRestore();
    });
});
