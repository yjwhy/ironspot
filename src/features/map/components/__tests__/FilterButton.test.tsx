import { fireEvent, render } from '@testing-library/react-native';

import { FilterButton } from '../FilterButton';

describe('FilterButton', () => {
  it('renders filter icon button', () => {
    const { getByRole } = render(<FilterButton activeCount={0} onPress={() => undefined} />);
    expect(getByRole('button', { name: '필터' })).toBeTruthy();
  });

  it('does not show badge when activeCount is 0', () => {
    const { queryByTestId } = render(<FilterButton activeCount={0} onPress={() => undefined} />);
    expect(queryByTestId('filter-badge')).toBeNull();
  });

  it('shows badge with count when activeCount > 0', () => {
    const { getByTestId, getByText } = render(
      <FilterButton activeCount={2} onPress={() => undefined} />,
    );
    expect(getByTestId('filter-badge')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<FilterButton activeCount={0} onPress={onPress} />);
    fireEvent.press(getByRole('button', { name: '필터' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
