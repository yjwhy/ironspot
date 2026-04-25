import { render } from '@testing-library/react-native';

import { Skeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('renders rectangle variant with width/height and rectangle radius', () => {
    const { getByTestId } = render(<Skeleton testID="rect" width={120} height={20} />);
    expect(getByTestId('rect')).toHaveStyle({ width: 120, height: 20, borderRadius: 8 });
  });

  it('renders circle variant with size as both dimensions and half-radius', () => {
    const { getByTestId } = render(<Skeleton testID="circ" variant="circle" size={48} />);
    expect(getByTestId('circ')).toHaveStyle({ width: 48, height: 48, borderRadius: 24 });
  });

  it('exposes accessibilityRole=progressbar so screen readers announce loading state', () => {
    const { getByTestId } = render(<Skeleton testID="skel" width={120} height={20} />);
    expect(getByTestId('skel')).toHaveProp('accessibilityRole', 'progressbar');
    expect(getByTestId('skel')).toHaveProp('accessibilityLabel', '로딩 중');
  });

  it('forwards testID', () => {
    const { getByTestId } = render(<Skeleton testID="my-skel" width={10} height={10} />);
    expect(getByTestId('my-skel')).toBeTruthy();
  });
});
