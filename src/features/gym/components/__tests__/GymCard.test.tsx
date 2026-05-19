import { fireEvent, render } from '@testing-library/react-native';
import { Image } from 'expo-image';

import type { GymWithMachineCount } from '@/shared/types/database';

import { GymCard } from '../GymCard';

const baseGym: GymWithMachineCount = {
  id: 'g1',
  name: 'Fitness Factory',
  address: '서울 강남구 역삼동 123-4',
  latitude: 37.5,
  longitude: 127.03,
  phone: null,
  operating_hours: null,
  day_pass_price: null,
  is_verified: true,
  last_verified_at: '2026-03-15T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  machine_count: 12,
  matched_machine_names: [],
};

function renderCard(overrides: Partial<React.ComponentProps<typeof GymCard>> = {}) {
  return render(
    <GymCard
      gym={baseGym}
      distanceKm={0.32}
      index={0}
      onPress={() => undefined}
      testID="gym-card"
      {...overrides}
    />,
  );
}

describe('GymCard', () => {
  it('renders the gym name', () => {
    const { getByText } = renderCard();
    expect(getByText('Fitness Factory')).toBeTruthy();
  });

  it('renders the formatted distance for sub-1km values', () => {
    const { getByText } = renderCard({ distanceKm: 0.32 });
    expect(getByText('0.3km')).toBeTruthy();
  });

  it('renders the formatted distance for over-1km values', () => {
    const { getByText } = renderCard({ distanceKm: 1.24 });
    expect(getByText('1.2km')).toBeTruthy();
  });

  it('renders the registered-count copy with the "등록된 기구 N대" phrasing when N > 0', () => {
    // Phase 5 item 19: clarify that the count is our registered set, not the
    // gym's actual total. Avoids the "this gym only has 12 machines" misread.
    const { getByText } = renderCard();
    expect(getByText('등록된 기구 12대')).toBeTruthy();
  });

  it('renders the friendlier "아직 등록된 기구가 없어요" copy when machine_count is 0', () => {
    // Phase 5 item 19: "등록된 기구 0대" is grammatically correct but reads
    // coldly; the alternative invites contribution.
    const { getByText, queryByText } = renderCard({
      gym: { ...baseGym, machine_count: 0 },
    });
    expect(getByText('아직 등록된 기구가 없어요')).toBeTruthy();
    expect(queryByText('등록된 기구 0대')).toBeNull();
  });

  it('does not render the matched-machines line', () => {
    // Phase 5 item 19: the matched-machine name list is removed from the card
    // to keep the bottom sheet dense; details live on GymDetail.
    const { queryByTestId } = renderCard({
      gym: {
        ...baseGym,
        matched_machine_names: ['Panatta High Row', 'Hammer Strength Chest Press'],
      },
    });
    expect(queryByTestId('gym-card-matched-machines')).toBeNull();
  });

  it('renders the formatted last verified date when present', () => {
    const { getByText } = renderCard();
    expect(getByText('확인일 2026.03.15')).toBeTruthy();
  });

  it('omits the verified date row when last_verified_at is null', () => {
    const { queryByText } = renderCard({
      gym: { ...baseGym, last_verified_at: null },
    });
    expect(queryByText(/^확인일/)).toBeNull();
  });

  it('renders an Image when thumbnailUrl is provided', () => {
    const { UNSAFE_queryAllByType } = renderCard({
      thumbnailUrl: 'https://example.com/photo.jpg',
    });
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(1);
  });

  it('renders no Image when thumbnailUrl is omitted (placeholder only)', () => {
    const { UNSAFE_queryAllByType } = renderCard({ thumbnailUrl: null });
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('exposes name, distance, registered-count and verified date via accessibility label', () => {
    const { getByRole } = renderCard();
    expect(
      getByRole('button', {
        name: 'Fitness Factory, 0.3km, 등록된 기구 12대, 확인일 2026.03.15',
      }),
    ).toBeTruthy();
  });

  it('uses the friendlier copy in the accessibility label when machine_count is 0', () => {
    const { getByRole } = renderCard({
      gym: { ...baseGym, machine_count: 0, last_verified_at: null },
    });
    expect(
      getByRole('button', { name: 'Fitness Factory, 0.3km, 아직 등록된 기구가 없어요' }),
    ).toBeTruthy();
  });

  it('drops the verified segment from the accessibility label when last_verified_at is null', () => {
    const { getByRole } = renderCard({ gym: { ...baseGym, last_verified_at: null } });
    expect(getByRole('button', { name: 'Fitness Factory, 0.3km, 등록된 기구 12대' })).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderCard({ onPress });
    fireEvent.press(getByTestId('gym-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
