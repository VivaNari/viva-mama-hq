/**
 * resolveInfantLogParams — what a GROWTH_LOG_NUDGE / VACCINATION_DUE / MILESTONE_DUE push
 * hands the log screens, resolved from the childId the push carries alone.
 *
 * `GET /user` (`getUserData`) is the one place `childs[]` is read from anywhere in this
 * app (see `apps/mobile/src/api/child.api.ts`'s own comment) — this is that same call,
 * from a new call site, not a second source of the same rows.
 *
 * Run:  npx jest resolveInfantLogParams
 */
jest.mock('../src/api/userData.api', () => ({ getUserData: jest.fn() }));

import { resolveInfantLogParams } from '../src/utils/resolveInfantLogParams';
import { getUserData } from '../src/api/userData.api';

const getUserDataMock = getUserData as jest.Mock;

const userDataResponse = (childs: object[]) => ({
    data: { user: { childs } },
    message: 'ok',
    statusCode: 200,
    success: true,
});

beforeEach(() => {
    getUserDataMock.mockReset();
});

describe('resolveInfantLogParams', () => {
    it('resolves the matching child into serialisable route params', async () => {
        getUserDataMock.mockResolvedValue(
            userDataResponse([
                {
                    _id: 'child-1',
                    name: 'Aarav',
                    date_of_birth: '2026-03-14T00:00:00.000Z',
                    sex: 'Male',
                    vaccination_sector: 'public',
                },
            ]),
        );

        const params = await resolveInfantLogParams('child-1');

        expect(params).toEqual({
            childId: 'child-1',
            childName: 'Aarav',
            childDob: '2026-03-14T00:00:00.000Z',
            childSex: 'Male',
            vaccinationSector: 'public',
        });
    });

    it('returns null when no child on the user matches the id', async () => {
        getUserDataMock.mockResolvedValue(
            userDataResponse([{ _id: 'someone-elses-child', name: 'Diya' }]),
        );

        expect(await resolveInfantLogParams('child-1')).toBeNull();
    });

    it('returns null rather than throwing when the fetch fails', async () => {
        getUserDataMock.mockRejectedValue(new Error('network down'));

        await expect(resolveInfantLogParams('child-1')).resolves.toBeNull();
    });

    it('carries an undefined date of birth as undefined, not a stray Date', async () => {
        getUserDataMock.mockResolvedValue(
            userDataResponse([{ _id: 'child-1', name: 'Aarav' }]),
        );

        const params = await resolveInfantLogParams('child-1');

        expect(params?.childDob).toBeUndefined();
    });
});
