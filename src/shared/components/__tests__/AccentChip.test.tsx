import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AccentChip } from '../AccentChip';

describe('AccentChip', () => {
  it('renders text children', () => {
    const { getByText } = render(<AccentChip>기구 12대</AccentChip>);
    expect(getByText('기구 12대')).toBeTruthy();
  });

  it('forwards testID', () => {
    const { getByTestId } = render(<AccentChip testID="chip">12</AccentChip>);
    expect(getByTestId('chip')).toBeTruthy();
  });

  it('wraps non-string children in the chip Text node', () => {
    const { getByText } = render(
      <AccentChip>
        <Text>nested</Text>
      </AccentChip>,
    );
    expect(getByText('nested')).toBeTruthy();
  });
});
