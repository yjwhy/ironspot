import { fireEvent, render } from '@testing-library/react-native';
import { Image } from 'expo-image';

import type { MachinePhoto } from '@/shared/types/database';

import { PhotoGrid } from '../PhotoGrid';

function makePhoto(overrides: Partial<MachinePhoto> = {}): MachinePhoto {
  return {
    id: 'photo-1',
    gym_machine_id: 'gm-1',
    user_id: null,
    photo_url: 'https://example.com/photo-1.jpg',
    upvote_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('PhotoGrid', () => {
  it('renders nothing when photos array is empty', () => {
    const { queryByText, queryByTestId } = render(
      <PhotoGrid photos={[]} onPressPhoto={() => undefined} />,
    );
    expect(queryByText('Best Cut')).toBeNull();
    expect(queryByTestId('photo-grid-best-cut')).toBeNull();
  });

  it('renders the first photo as Best Cut hero (input is already upvote_count desc)', () => {
    const photos = [
      makePhoto({ id: 'top', upvote_count: 42, created_at: '2026-03-01T00:00:00Z' }),
      makePhoto({ id: 'second', upvote_count: 5 }),
    ];
    const { getByText, getByTestId } = render(
      <PhotoGrid photos={photos} onPressPhoto={() => undefined} />,
    );
    expect(getByText('Best Cut')).toBeTruthy();
    expect(getByText('추천 42')).toBeTruthy();
    expect(getByText('2026.03.01')).toBeTruthy();
    expect(getByTestId('photo-grid-best-cut')).toBeTruthy();
  });

  it('renders no grid cells when only the Best Cut exists', () => {
    const { queryAllByTestId } = render(
      <PhotoGrid photos={[makePhoto({ id: 'only' })]} onPressPhoto={() => undefined} />,
    );
    expect(queryAllByTestId(/^photo-grid-cell-/)).toHaveLength(0);
  });

  it('orders grid cells by created_at descending (newest first), independent of input order', () => {
    const photos = [
      makePhoto({ id: 'top', upvote_count: 99 }),
      makePhoto({ id: 'older', created_at: '2026-01-15T00:00:00Z' }),
      makePhoto({ id: 'newer', created_at: '2026-02-15T00:00:00Z' }),
    ];
    const { getAllByTestId } = render(<PhotoGrid photos={photos} onPressPhoto={() => undefined} />);
    const cells = getAllByTestId(/^photo-grid-cell-/);
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveProp('testID', 'photo-grid-cell-newer');
    expect(cells[1]).toHaveProp('testID', 'photo-grid-cell-older');
  });

  it('calls onPressPhoto with the Best Cut id when its hero is tapped', () => {
    const onPressPhoto = jest.fn();
    const { getByTestId } = render(
      <PhotoGrid photos={[makePhoto({ id: 'top' })]} onPressPhoto={onPressPhoto} />,
    );
    fireEvent.press(getByTestId('photo-grid-best-cut'));
    expect(onPressPhoto).toHaveBeenCalledWith('top');
  });

  it('calls onPressPhoto with the cell id when a grid cell is tapped', () => {
    const onPressPhoto = jest.fn();
    const photos = [
      makePhoto({ id: 'top' }),
      makePhoto({ id: 'cell-a', created_at: '2026-02-01T00:00:00Z' }),
      makePhoto({ id: 'cell-b', created_at: '2026-01-01T00:00:00Z' }),
    ];
    const { getByTestId } = render(<PhotoGrid photos={photos} onPressPhoto={onPressPhoto} />);
    fireEvent.press(getByTestId('photo-grid-cell-cell-a'));
    expect(onPressPhoto).toHaveBeenCalledWith('cell-a');
  });

  it('renders one Image per photo (Best Cut + grid cells)', () => {
    const photos = [
      makePhoto({ id: 'top' }),
      makePhoto({ id: 'p2', created_at: '2026-02-01T00:00:00Z' }),
      makePhoto({ id: 'p3', created_at: '2026-01-01T00:00:00Z' }),
    ];
    const { UNSAFE_queryAllByType } = render(
      <PhotoGrid photos={photos} onPressPhoto={() => undefined} />,
    );
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(3);
  });

  it('exposes grid cells via accessibility label containing upvote count and date', () => {
    const photos = [
      makePhoto({ id: 'top' }),
      makePhoto({ id: 'cell-a', upvote_count: 7, created_at: '2026-02-15T00:00:00Z' }),
    ];
    const { getByLabelText } = render(<PhotoGrid photos={photos} onPressPhoto={() => undefined} />);
    expect(getByLabelText(/추천 7.*2026\.02\.15/)).toBeTruthy();
  });

  it('exposes the Best Cut hero via accessibility label containing upvote and date', () => {
    const photos = [makePhoto({ id: 'top', upvote_count: 12, created_at: '2026-03-15T00:00:00Z' })];
    const { getByLabelText } = render(<PhotoGrid photos={photos} onPressPhoto={() => undefined} />);
    expect(getByLabelText(/^베스트 컷.*추천 12.*2026\.03\.15/)).toBeTruthy();
  });
});
