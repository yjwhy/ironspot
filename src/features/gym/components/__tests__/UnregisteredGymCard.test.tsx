import { fireEvent, render } from '@testing-library/react-native';

import { UnregisteredGymCard } from '../UnregisteredGymCard';

describe('UnregisteredGymCard', () => {
  const baseProps = {
    naverPlaceId: 'naver-id-100',
    name: '강남헬스클럽',
    address: '서울 강남구 역삼동 100',
    distanceKm: 0.5,
    index: 0,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders name + address + formatted distance', () => {
    const { getByText } = render(<UnregisteredGymCard {...baseProps} />);
    expect(getByText('강남헬스클럽')).toBeTruthy();
    expect(getByText('서울 강남구 역삼동 100')).toBeTruthy();
    expect(getByText('0.5km')).toBeTruthy();
  });

  it('shows the unregistered label and "첫 등록자 되어" CTA copy', () => {
    const { getByText } = render(<UnregisteredGymCard {...baseProps} />);
    expect(getByText('아직 등록되지 않은 헬스장')).toBeTruthy();
    // Arrow suffix is decorative; assert prefix substring instead.
    expect(getByText(/첫 등록자 되어 정보 추가하기/)).toBeTruthy();
  });

  it('calls onPress when the card is tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<UnregisteredGymCard {...baseProps} onPress={onPress} />);
    fireEvent.press(getByRole('button', { name: /강남헬스클럽/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes a single accessibility label combining name, distance, label, CTA', () => {
    const { getByLabelText } = render(<UnregisteredGymCard {...baseProps} />);
    expect(
      getByLabelText(
        '강남헬스클럽, 0.5km, 아직 등록되지 않은 헬스장, 첫 등록자 되어 정보 추가하기',
      ),
    ).toBeTruthy();
  });
});
