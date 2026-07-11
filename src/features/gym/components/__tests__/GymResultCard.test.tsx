import { fireEvent, render } from '@testing-library/react-native';
import { Image } from 'expo-image';

import type { GymResultCardModel } from '../../lib/gym-result-card-model';
import { GymResultCard } from '../GymResultCard';

const populated: GymResultCardModel = {
  id: 'g1',
  name: '카인드짐 보정점',
  distanceKm: 0.32,
  address: '경기 용인 기흥구 보정로 57',
  machineCount: 12,
  thumbnailUrl: null,
  lastVerifiedAt: '2026-03-15T10:00:00Z',
  latitude: 37.5,
  longitude: 127.03,
  naverPlaceId: null,
};

const empty: GymResultCardModel = {
  ...populated,
  id: 'naver-1',
  name: '더뺌 보정점',
  machineCount: 0,
  lastVerifiedAt: null,
  naverPlaceId: 'naver-1',
};

function renderCard(model: GymResultCardModel, onPress = jest.fn()) {
  return { onPress, ...render(<GymResultCard model={model} index={0} onPress={onPress} />) };
}

describe('GymResultCard', () => {
  it('shows the machine count and no contribution CTA when the gym has machines', () => {
    const { getByText, queryByText } = renderCard(populated);
    expect(getByText('등록된 머신 12대')).toBeTruthy();
    expect(queryByText(/첫 정보 추가하기/)).toBeNull();
  });

  it('shows the shared empty copy + contribution CTA when there are no machines', () => {
    const { getByText } = renderCard(empty);
    expect(getByText('아직 등록된 머신이 없어요')).toBeTruthy();
    expect(getByText(/첫 정보 추가하기/)).toBeTruthy();
  });

  it('renders the address line for both registered and unregistered models', () => {
    expect(renderCard(populated).getByText('경기 용인 기흥구 보정로 57')).toBeTruthy();
    expect(renderCard(empty).getByText('경기 용인 기흥구 보정로 57')).toBeTruthy();
  });

  it('renders the cover thumbnail when present, otherwise the fitness icon', () => {
    const withCover = { ...populated, thumbnailUrl: 'https://cdn.example.com/c.jpg' };
    expect(
      render(<GymResultCard model={withCover} index={0} onPress={jest.fn()} />).UNSAFE_queryByType(
        Image,
      ),
    ).toBeTruthy();
    expect(
      render(<GymResultCard model={empty} index={0} onPress={jest.fn()} />).UNSAFE_queryByType(
        Image,
      ),
    ).toBeNull();
  });

  it('fires onPress when the card is tapped', () => {
    const { getByRole, onPress } = renderCard(empty);
    fireEvent.press(getByRole('button', { name: /더뺌 보정점/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
