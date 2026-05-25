import { fireEvent, render } from '@testing-library/react-native';

import { SearchAreaButton } from '../SearchAreaButton';

describe('SearchAreaButton', () => {
  it('renders when visible', () => {
    const { getByText } = render(<SearchAreaButton visible={true} onPress={jest.fn()} />);
    expect(getByText('이 지역 재검색')).toBeTruthy();
  });

  it('returns null when not visible', () => {
    const { toJSON } = render(<SearchAreaButton visible={false} onPress={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<SearchAreaButton visible={true} onPress={onPress} />);
    fireEvent.press(getByText('이 지역 재검색'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
