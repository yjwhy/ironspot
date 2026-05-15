import { fireEvent, render } from '@testing-library/react-native';

import { PermissionDeniedBadge } from '../PermissionDeniedBadge';

describe('PermissionDeniedBadge', () => {
  it('renders the Korean fallback explanation', () => {
    const { getByText } = render(<PermissionDeniedBadge onPress={() => undefined} />);
    expect(getByText('위치 권한 거부됨 — 강남역 기준')).toBeTruthy();
  });

  it('invokes the supplied onPress override (instead of opening OS settings)', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<PermissionDeniedBadge onPress={onPress} />);
    fireEvent.press(getByLabelText(/위치 권한 거부됨/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
