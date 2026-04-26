import { fireEvent, render } from '@testing-library/react-native';

import { Chip } from '../Chip';

describe('Chip', () => {
  it('renders the label', () => {
    const { getByText } = render(
      <Chip label="플레이트" selected={false} onPress={() => undefined} />,
    );
    expect(getByText('플레이트')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Chip label="플레이트" selected={false} onPress={onPress} />);
    fireEvent.press(getByText('플레이트'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes selected state via accessibility', () => {
    const { getByRole } = render(
      <Chip label="플레이트" selected={true} onPress={() => undefined} />,
    );
    expect(getByRole('button', { selected: true })).toBeTruthy();
  });

  it('exposes unselected state via accessibility', () => {
    const { getByRole } = render(
      <Chip label="플레이트" selected={false} onPress={() => undefined} />,
    );
    expect(getByRole('button', { selected: false })).toBeTruthy();
  });

  it('forwards testID to the pressable', () => {
    const { getByTestId } = render(
      <Chip label="플레이트" selected={false} onPress={() => undefined} testID="chip-plate" />,
    );
    expect(getByTestId('chip-plate')).toBeTruthy();
  });
});
