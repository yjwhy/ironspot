import { fireEvent, render } from '@testing-library/react-native';

import { AppText } from '../AppText';

describe('AppText', () => {
  it('renders text children', () => {
    const { getByText } = render(<AppText>안녕하세요</AppText>);
    expect(getByText('안녕하세요')).toBeTruthy();
  });

  it('applies font-sans by default so Pretendard-Regular is the resolved family', () => {
    const { getByTestId } = render(<AppText testID="t">x</AppText>);
    expect(getByTestId('t')).toHaveProp('className', expect.stringContaining('font-sans'));
  });

  it('appends user className after the default so font-medium overrides Pretendard-Regular', () => {
    const { getByTestId } = render(
      <AppText testID="t" className="font-medium text-body-sm">
        x
      </AppText>,
    );
    expect(getByTestId('t')).toHaveProp(
      'className',
      expect.stringMatching(/font-sans .*font-medium/),
    );
    expect(getByTestId('t')).toHaveProp('className', expect.stringContaining('text-body-sm'));
  });

  it('renders cleanly when no className is provided', () => {
    const { getByTestId } = render(<AppText testID="t">x</AppText>);
    expect(getByTestId('t')).toHaveProp('className', expect.stringMatching(/^font-sans\s*$/));
  });

  it('forwards numberOfLines to the underlying Text', () => {
    const { getByTestId } = render(
      <AppText testID="t" numberOfLines={1}>
        long content
      </AppText>,
    );
    expect(getByTestId('t')).toHaveProp('numberOfLines', 1);
  });

  it('forwards accessibilityRole and is queryable as a header', () => {
    const { getByRole } = render(<AppText accessibilityRole="header">제목</AppText>);
    expect(getByRole('header', { name: '제목' })).toBeTruthy();
  });

  it('forwards onPress so taps fire from the underlying Text', () => {
    const onPress = jest.fn();
    const { getByText } = render(<AppText onPress={onPress}>tap me</AppText>);
    fireEvent.press(getByText('tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
