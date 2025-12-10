/**
 * __tests__/articlecard_onboarding_contexts.test.tsx
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ArticleCard } from '../src/components/ArticleCard';
import PHQInputRenderer from '../src/components/onboarding/PHQInputRenderer';
import OnboardingStep from '../src/components/onboarding/OnboardingStep';
import { useAuth } from '../src/context/AuthContext';
import { useCounterContext } from '../src/context/CounterContext';

// ----------------------
// Mock navigation
// ----------------------
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// ----------------------
// ARTICLE CARD TESTS
// ----------------------

describe('ArticleCard component', () => {
  afterEach(() => mockNavigate.mockClear());

  test('renders title & content and navigates on press', () => {
    const item = {
      id: 'art1',
      title: 'Test Article',
      content: 'This is content',
      thumbnailImage: { uri: 'https://sample.com/img.png' }
    } as any;

    const { getByText } = render(<ArticleCard item={item} />);

    expect(getByText('Test Article')).toBeTruthy();
    expect(getByText('This is content')).toBeTruthy();

    fireEvent.press(getByText('Test Article'));

    expect(mockNavigate).toHaveBeenCalledWith('ArticleDetails', { articleId: 'art1' });
  });
});

// ----------------------
// PHQInputRenderer tests
// ----------------------

describe('PHQInputRenderer', () => {
  test('text input calls onChange', () => {
    const onChange = jest.fn();
    const q = {
      answerType: 'text',
      placeholder: 'enter',
      answer: '',
      options: []
    } as any;

    const { getByPlaceholderText } = render(
      <PHQInputRenderer question={q} onChange={onChange} />
    );

    fireEvent.changeText(getByPlaceholderText('enter'), 'hello');
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  test('numeric input calls onChange with number', () => {
    const onChange = jest.fn();
    const q = {
      answerType: 'numeric',
      placeholder: 'age',
      answer: '',
      options: []
    } as any;

    const { getByPlaceholderText } = render(
      <PHQInputRenderer question={q} onChange={onChange} />
    );

    fireEvent.changeText(getByPlaceholderText('age'), '42');
    expect(onChange).toHaveBeenCalledWith(42);
  });

  test('select single-choice calls onChange', () => {
    const onChange = jest.fn();
    const q = {
      answerType: 'select',
      placeholder: '',
      isMultichoice: false,
      options: [
        { label: 'A', value: 'a' }
      ],
      answer: null
    } as any;

    const { getByText } = render(
      <PHQInputRenderer question={q} onChange={onChange} />
    );

    fireEvent.press(getByText('A'));
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

// ----------------------
// OnboardingStep tests
// ----------------------

describe('OnboardingStep component', () => {
  test('renders fields when currentStep matches step', () => {
    const phqs = [
        { answerType: 'text', placeholder: 'p1', answer: '' },
        { answerType: 'text', placeholder: 'p2', answer: '' }
    ] as any[];

    const { getByPlaceholderText } = render(
        <OnboardingStep
        phqsPerStep={phqs}
        step={1}           // numeric ✔
        currentStep={1}    // numeric ✔
        phqLength={phqs.length}
        onAnswerChange={() => {}}
        answers={{}}
        stepIndex={0}
        />
    );

    expect(getByPlaceholderText('p1')).toBeTruthy();
    expect(getByPlaceholderText('p2')).toBeTruthy();
  });

});

// ----------------------
// Context Hook Tests
// ----------------------

describe('Context hooks safety checks', () => {
  test('useAuth throws outside provider', () => {
    const Consumer = () => {
      useAuth();
      return null;
    };
    
    expect(() => render(<Consumer />)).toThrow();
  });

  test('useCounterContext throws outside provider', () => {
    const Consumer = () => {
      useCounterContext();
      return null;
    };

    expect(() => render(<Consumer />)).toThrow();
  });
});
