import {
  ABHA_CARD_NODE_ID,
  ABHA_NUMBER_NODE_ID,
  CARE_FACILITY_NODE_ID,
  HEIGHT_NODE_ID,
  WEIGHT_NODE_ID,
  maskAbhaNumber,
  normalizeAbhaNumber,
} from '../src/constants/chat';
import { IAiMessage, IChatMessage, NodeType } from '../src/types/chat.types';
import { toHeightCm, toWeightKg, weightBoundsIn } from '../src/utils/measurementUnits';
import {
  determineInputMode,
  isSkippableNode,
  validateMeasurement,
} from '../src/utils/messageHelpers';

const question = (id: string): IChatMessage =>
  ({
    type: 'ai',
    id,
    text: 'q',
    nodeType: NodeType.QUESTION_FREE_TEXT,
    options: [],
  }) as unknown as IAiMessage;

const t = ((key: string) => key) as any;

describe('measurement units', () => {
  it('sends weight in kg to one decimal', () => {
    expect(toWeightKg('62.46', 'kg')).toBe(62.5);
    expect(toWeightKg('140', 'lb')).toBe(63.5);
  });

  it('rejects a weight outside the allowed range in either unit', () => {
    expect(toWeightKg('29', 'kg')).toBeNull();
    expect(toWeightKg('201', 'kg')).toBeNull();
    expect(toWeightKg('50', 'lb')).toBeNull();
    expect(toWeightKg('abc', 'kg')).toBeNull();
  });

  it('sends height in whole cm', () => {
    expect(toHeightCm('160', '', 'cm')).toBe(160);
    expect(toHeightCm('5', '4', 'ft')).toBe(163);
    expect(toHeightCm('5', '', 'ft')).toBe(152);
  });

  it('rejects a height outside the allowed range, or impossible inches', () => {
    expect(toHeightCm('90', '', 'cm')).toBeNull();
    expect(toHeightCm('3', '0', 'ft')).toBeNull();
    expect(toHeightCm('8', '0', 'ft')).toBeNull();
    expect(toHeightCm('5', '12', 'ft')).toBeNull();
  });

  it('states the weight limits in her unit', () => {
    expect(weightBoundsIn('kg')).toEqual({ min: 30, max: 200 });
    expect(weightBoundsIn('lb')).toEqual({ min: 67, max: 440 });
  });
});

describe('ABHA number', () => {
  it('accepts 14 digits, with or without separators', () => {
    expect(normalizeAbhaNumber('12345678901234')).toBe('12345678901234');
    expect(normalizeAbhaNumber('12-3456-7890-1234')).toBe('12345678901234');
    expect(normalizeAbhaNumber('1234')).toBeNull();
    expect(normalizeAbhaNumber('1234567890123a')).toBeNull();
  });

  it('shows only the last four digits', () => {
    expect(maskAbhaNumber('12345678901234')).toBe('**********1234');
  });

  it('blocks sending until the number is valid', () => {
    const node = question(ABHA_NUMBER_NODE_ID);
    expect(validateMeasurement(node, '123', t)).toBe('chat.abha.invalidNumber');
    expect(validateMeasurement(node, '12345678901234', t)).toBeNull();
  });
});

describe('pregnancy counts', () => {
  it('keeps pregnancies at 2 or more, as whole numbers', () => {
    const node = question('pregnancies');
    expect(validateMeasurement(node, '1', t)).toBe('chat.countOutOfRange');
    expect(validateMeasurement(node, '2.5', t)).toBe('chat.countOutOfRange');
    expect(validateMeasurement(node, '2', t)).toBeNull();
  });

  it('allows zero living children, and more children than pregnancies', () => {
    const node = question('living_children');
    expect(validateMeasurement(node, '0', t)).toBeNull();
    expect(validateMeasurement(node, '3', t)).toBeNull();
  });
});

describe('input mode for new questions', () => {
  const mode = (id: string) => determineInputMode(question(id), false, false);

  it('picks the right control for each question', () => {
    expect(mode(WEIGHT_NODE_ID)).toBe('weight');
    expect(mode(HEIGHT_NODE_ID)).toBe('height');
    expect(mode(ABHA_CARD_NODE_ID)).toBe('abhaCard');
    expect(mode(ABHA_NUMBER_NODE_ID)).toBe('number');
    expect(mode('pregnancies')).toBe('number');
    expect(mode('living_children')).toBe('number');
    expect(mode(CARE_FACILITY_NODE_ID)).toBe('text');
  });

  it('offers Skip on the care facility question only', () => {
    expect(isSkippableNode(question(CARE_FACILITY_NODE_ID))).toBe(true);
    expect(isSkippableNode(question('location'))).toBe(false);
    expect(isSkippableNode(undefined)).toBe(false);
  });
});
