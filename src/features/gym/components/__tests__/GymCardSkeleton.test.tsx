import { render } from '@testing-library/react-native';

import { Skeleton } from '@/shared/components/Skeleton';

import { GymCardSkeleton } from '../GymCardSkeleton';

describe('GymCardSkeleton', () => {
  it('renders with accessible label', () => {
    const { getByLabelText } = render(<GymCardSkeleton />);
    expect(getByLabelText('헬스장 정보 로딩 중')).toBeTruthy();
  });

  it('renders five skeleton rows: thumbnail, name, meta, chip, verified-date', () => {
    const { UNSAFE_getAllByType } = render(<GymCardSkeleton />);
    expect(UNSAFE_getAllByType(Skeleton)).toHaveLength(5);
  });
});
