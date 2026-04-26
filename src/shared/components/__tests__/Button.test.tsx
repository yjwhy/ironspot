import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('renders the label', () => {
    const { getByText } = render(<Button label="확인" onPress={() => undefined} />);
    expect(getByText('확인')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="확인" onPress={onPress} />);
    fireEvent.press(getByText('확인'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hides label and ignores press when loading', () => {
    const onPress = jest.fn();
    const { getByTestId, queryByText } = render(
      <Button label="확인" onPress={onPress} loading testID="btn" />,
    );
    expect(queryByText('확인')).toBeNull();
    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('ignores press when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="확인" onPress={onPress} disabled />);
    fireEvent.press(getByText('확인'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders all variants without crashing', () => {
    const variants = ['primary', 'secondary', 'ghost'] as const;
    variants.forEach((variant) => {
      const { getByText } = render(
        <Button key={variant} label={variant} onPress={() => undefined} variant={variant} />,
      );
      expect(getByText(variant)).toBeTruthy();
    });
  });

  it('renders both sizes without crashing', () => {
    const sizes = ['md', 'sm'] as const;
    sizes.forEach((size) => {
      const { getByText } = render(
        <Button key={size} label={size} onPress={() => undefined} size={size} />,
      );
      expect(getByText(size)).toBeTruthy();
    });
  });

  it('exposes accessibility role and busy state when loading', () => {
    const { getByRole } = render(
      <Button label="확인" onPress={() => undefined} loading testID="btn" />,
    );
    expect(getByRole('button', { busy: true, disabled: true })).toBeTruthy();
  });

  it('exposes disabled accessibility state when disabled', () => {
    const { getByRole } = render(<Button label="확인" onPress={() => undefined} disabled />);
    expect(getByRole('button', { disabled: true, busy: false })).toBeTruthy();
  });
});
