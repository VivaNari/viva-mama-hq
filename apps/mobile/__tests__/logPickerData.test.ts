import { getMainTiles } from '../src/data/logPickerData';
import { CareModelEnum, UserCategoryEnum } from '../src/types/user.types';

const keys = (careModel: CareModelEnum, category: UserCategoryEnum | null) =>
  getMainTiles(careModel, category).map(tile => tile.key);

describe('the checkup tile', () => {
  it.each([CareModelEnum.PUBLIC, CareModelEnum.PRIVATE])('gives a pregnant %s woman ANC only', careModel => {
    const tiles = keys(careModel, UserCategoryEnum.NP);
    expect(tiles).toContain('anc');
    expect(tiles).not.toContain('pnc');
  });

  it.each([CareModelEnum.PUBLIC, CareModelEnum.PRIVATE])('gives a postpartum %s woman PNC only', careModel => {
    const tiles = keys(careModel, UserCategoryEnum.PP);
    expect(tiles).toContain('pnc');
    expect(tiles).not.toContain('anc');
  });

  it.each([CareModelEnum.PUBLIC, CareModelEnum.PRIVATE])('gives a %s woman who is neither no checkup', careModel => {
    const tiles = keys(careModel, UserCategoryEnum.NN);
    expect(tiles).not.toContain('anc');
    expect(tiles).not.toContain('pnc');
  });

  it('leaves no hole in the two-column grid', () => {
    for (const careModel of [CareModelEnum.PUBLIC, CareModelEnum.PRIVATE]) {
      for (const category of [UserCategoryEnum.NP, UserCategoryEnum.PP, UserCategoryEnum.NN]) {
        const cells = getMainTiles(careModel, category).reduce((sum, tile) => sum + (tile.wide ? 2 : 1), 0);
        expect(cells % 2).toBe(0);
      }
    }
  });
});
