import { render } from '@testing-library/react-native';
import React from 'react';

import { UNREGISTERED_MARKER_SIZE, UnregisteredMarkerView } from '../UnregisteredMarkerView';

describe('UnregisteredMarkerView', () => {
  it('renders the "+" first-registrant glyph', () => {
    const { getByText } = render(<UnregisteredMarkerView />);
    expect(getByText('+')).toBeTruthy();
  });

  it('renders an outlined (white background) bubble at the unregistered size', () => {
    const { getByTestId } = render(<UnregisteredMarkerView />);
    expect(getByTestId('unregistered-marker-bubble')).toHaveStyle({
      width: UNREGISTERED_MARKER_SIZE.width,
      height: UNREGISTERED_MARKER_SIZE.height,
      backgroundColor: '#FFFFFF',
    });
  });

  it('exposes a stable testID on the marker view container', () => {
    const { getByTestId } = render(<UnregisteredMarkerView />);
    expect(getByTestId('unregistered-marker-view')).toBeTruthy();
  });
});
