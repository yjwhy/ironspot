import { fireEvent, render } from '@testing-library/react-native';

import type { ActiveFilter } from '../../lib/active-filters';
import { ActiveFilterStrip } from '../ActiveFilterStrip';

const filters: ActiveFilter[] = [
  { kind: 'brand', id: 'b1', label: 'Panatta' },
  { kind: 'category', id: 'c1', label: '등' },
  { kind: 'machineTemplate', id: 't1', label: 'Panatta High Row · 핀' },
];

describe('ActiveFilterStrip', () => {
  it('renders nothing when filter list is empty', () => {
    const { toJSON } = render(<ActiveFilterStrip filters={[]} onRemove={() => undefined} />);
    expect(toJSON()).toBeNull();
  });

  it('renders a chip for every active filter', () => {
    const { getByText } = render(
      <ActiveFilterStrip filters={filters} onRemove={() => undefined} />,
    );
    expect(getByText('Panatta')).toBeTruthy();
    expect(getByText('등')).toBeTruthy();
    expect(getByText('Panatta High Row · 핀')).toBeTruthy();
  });

  it('calls onRemove with the matching filter when chip is pressed', () => {
    const onRemove = jest.fn();
    const { getByLabelText } = render(<ActiveFilterStrip filters={filters} onRemove={onRemove} />);
    fireEvent.press(getByLabelText('브랜드 Panatta 필터 제거'));
    expect(onRemove).toHaveBeenCalledWith(filters[0]);
  });

  it('uses kind-specific Korean prefix in accessibility labels', () => {
    const { getByLabelText } = render(
      <ActiveFilterStrip filters={filters} onRemove={() => undefined} />,
    );
    expect(getByLabelText('브랜드 Panatta 필터 제거')).toBeTruthy();
    expect(getByLabelText('운동 부위 등 필터 제거')).toBeTruthy();
    expect(getByLabelText('머신 Panatta High Row · 핀 필터 제거')).toBeTruthy();
  });

  it('forwards testID to the scroll container', () => {
    const { getByTestId } = render(
      <ActiveFilterStrip filters={filters} onRemove={() => undefined} testID="active-strip" />,
    );
    expect(getByTestId('active-strip')).toBeTruthy();
  });
});
