import { render } from '@testing-library/react-native';
import React from 'react';

import { GymMarkerView, MARKER_SIZE_DEFAULT, MARKER_SIZE_SELECTED } from '../GymMarkerView';

describe('GymMarkerView', () => {
  it('renders machine count text', () => {
    const { getByText } = render(
      <GymMarkerView machineCount={7} isSelected={false} isMismatch={false} />,
    );
    expect(getByText('7')).toBeTruthy();
  });

  it('uses default size when not selected', () => {
    const { getByTestId } = render(
      <GymMarkerView machineCount={3} isSelected={false} isMismatch={false} />,
    );
    expect(getByTestId('gym-marker-bubble')).toHaveStyle({
      width: MARKER_SIZE_DEFAULT.width,
      height: MARKER_SIZE_DEFAULT.height,
    });
  });

  it('uses selected size when isSelected', () => {
    const { getByTestId } = render(
      <GymMarkerView machineCount={3} isSelected={true} isMismatch={false} />,
    );
    expect(getByTestId('gym-marker-bubble')).toHaveStyle({
      width: MARKER_SIZE_SELECTED.width,
      height: MARKER_SIZE_SELECTED.height,
    });
  });

  it('renders mismatch state without crashing', () => {
    const { getByTestId } = render(
      <GymMarkerView machineCount={0} isSelected={false} isMismatch={true} />,
    );
    expect(getByTestId('gym-marker-view')).toBeTruthy();
  });

  it('renders zero count in mismatch state', () => {
    const { getByText } = render(
      <GymMarkerView machineCount={0} isSelected={false} isMismatch={true} />,
    );
    expect(getByText('0')).toBeTruthy();
  });
});
