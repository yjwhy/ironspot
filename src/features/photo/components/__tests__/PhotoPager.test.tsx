import { render } from '@testing-library/react-native';
import { Image } from 'expo-image';

import type { MachinePhoto } from '@/shared/types/database';
import { makeMachinePhoto } from '@/test/utils/factories/gym-machine';

import { clampIndex, PhotoPager } from '../PhotoPager';

function makePhoto(id: string, url: string): MachinePhoto {
  return makeMachinePhoto({ id, photo_url: url });
}

describe('PhotoPager', () => {
  it('renders one Image per photo', () => {
    const photos = [
      makePhoto('p1', 'https://example.com/1.jpg'),
      makePhoto('p2', 'https://example.com/2.jpg'),
      makePhoto('p3', 'https://example.com/3.jpg'),
    ];
    const { UNSAFE_queryAllByType } = render(<PhotoPager photos={photos} initialIndex={0} />);
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(3);
  });

  it('renders nothing when photos array is empty', () => {
    const { UNSAFE_queryAllByType } = render(<PhotoPager photos={[]} initialIndex={0} />);
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('exposes one accessible image label per photo for screen readers', () => {
    const photos = [makePhoto('p1', 'a'), makePhoto('p2', 'b'), makePhoto('p3', 'c')];
    const { getByLabelText } = render(<PhotoPager photos={photos} initialIndex={0} />);
    expect(getByLabelText('사진 1')).toBeTruthy();
    expect(getByLabelText('사진 2')).toBeTruthy();
    expect(getByLabelText('사진 3')).toBeTruthy();
  });
});

describe('clampIndex', () => {
  it('returns 0 when length is 0', () => {
    expect(clampIndex(5, 0)).toBe(0);
    expect(clampIndex(-3, 0)).toBe(0);
  });

  it('returns the value when within [0, length - 1]', () => {
    expect(clampIndex(0, 3)).toBe(0);
    expect(clampIndex(1, 3)).toBe(1);
    expect(clampIndex(2, 3)).toBe(2);
  });

  it('clamps negative values to 0', () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(-100, 3)).toBe(0);
  });

  it('clamps values past the end to length - 1', () => {
    expect(clampIndex(3, 3)).toBe(2);
    expect(clampIndex(99, 3)).toBe(2);
  });
});
