import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Card>
        <Text>안녕</Text>
      </Card>,
    );
    expect(getByText('안녕')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Card onPress={onPress} testID="card">
        <Text>tap me</Text>
      </Card>,
    );
    fireEvent.press(getByTestId('card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders as a static view (non-button) when onPress is omitted', () => {
    const { queryByRole } = render(
      <Card testID="static">
        <Text>static</Text>
      </Card>,
    );
    expect(queryByRole('button')).toBeNull();
  });

  it('renders as a button when onPress is provided', () => {
    const { getByRole } = render(
      <Card onPress={() => undefined}>
        <Text>pressable</Text>
      </Card>,
    );
    expect(getByRole('button')).toBeTruthy();
  });

  it('forwards testID', () => {
    const { getByTestId } = render(
      <Card testID="my-card">
        <Text>x</Text>
      </Card>,
    );
    expect(getByTestId('my-card')).toBeTruthy();
  });

  it('applies default padding (lg) when padding prop omitted', () => {
    const { getByTestId } = render(
      <Card testID="default">
        <Text>x</Text>
      </Card>,
    );
    expect(getByTestId('default')).toHaveProp('className', expect.stringContaining('p-4'));
  });

  it('applies the requested padding variant', () => {
    const { getByTestId } = render(
      <Card testID="sm" padding="sm">
        <Text>x</Text>
      </Card>,
    );
    expect(getByTestId('sm')).toHaveProp('className', expect.stringContaining('p-2'));
  });

  it('applies no padding when padding="none"', () => {
    const { getByTestId } = render(
      <Card testID="none" padding="none">
        <Text>x</Text>
      </Card>,
    );
    expect(getByTestId('none')).toHaveProp('className', expect.not.stringMatching(/\bp-\d/));
  });
});
