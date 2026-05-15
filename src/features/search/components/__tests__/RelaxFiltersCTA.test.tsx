import { fireEvent, render } from '@testing-library/react-native';

import { RelaxFiltersCTA } from '../RelaxFiltersCTA';

describe('RelaxFiltersCTA', () => {
  it('renders the no-result message + CTA button', () => {
    const { getByText } = render(<RelaxFiltersCTA onPress={() => undefined} />);
    expect(getByText('검색 결과가 없어요')).toBeTruthy();
    expect(getByText('필터로 검색')).toBeTruthy();
  });

  it('invokes onPress when the CTA button is tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<RelaxFiltersCTA onPress={onPress} />);
    fireEvent.press(getByText('필터로 검색'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
