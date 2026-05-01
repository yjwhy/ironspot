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

  it('renders machine count as a single chip', () => {
    const { getByText } = renderCard();
    expect(getByText('기구 12대')).toBeTruthy();
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

  it('exposes name, distance, machine count and verified date via accessibility label', () => {
    const { getByRole } = renderCard();
    expect(
      getByRole('button', {
        name: 'Fitness Factory, 0.3km, 기구 12대, 확인일 2026.03.15',
      }),
    ).toBeTruthy();
  });

  it('drops the verified segment from the accessibility label when last_verified_at is null', () => {
    const { getByRole } = renderCard({ gym: { ...baseGym, last_verified_at: null } });
    expect(getByRole('button', { name: 'Fitness Factory, 0.3km, 기구 12대' })).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderCard({ onPress });
    fireEvent.press(getByTestId('gym-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
