import { fireEvent, render } from '@testing-library/react-native';

import { SegmentedControl } from '../SegmentedControl';

type LoadingValue = 'pin' | 'plate' | null;

const segments = [
  { label: '전체', value: null },
  { label: '핀로딩', value: 'pin' },
  { label: '플레이트', value: 'plate' },
] as const satisfies readonly { label: string; value: LoadingValue }[];

describe('SegmentedControl', () => {
  it('renders all segment labels', () => {
    const { getByText } = render(
      <SegmentedControl segments={segments} value={null} onChange={() => undefined} />,
    );
    expect(getByText('전체')).toBeTruthy();
    expect(getByText('핀로딩')).toBeTruthy();
    expect(getByText('플레이트')).toBeTruthy();
  });

  it('exposes the container as tablist', () => {
    const { getByLabelText } = render(
      <SegmentedControl
        segments={segments}
        value={null}
        onChange={() => undefined}
        accessibilityLabel="로딩 방식"
      />,
    );
    expect(getByLabelText('로딩 방식')).toBeTruthy();
  });

  it('exposes selected state on the active tab', () => {
    const { getByRole } = render(
      <SegmentedControl segments={segments} value="pin" onChange={() => undefined} />,
    );
    expect(getByRole('tab', { name: '핀로딩', selected: true })).toBeTruthy();
    expect(getByRole('tab', { name: '전체', selected: false })).toBeTruthy();
    expect(getByRole('tab', { name: '플레이트', selected: false })).toBeTruthy();
  });

  it('calls onChange with the segment value when pressed', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <SegmentedControl segments={segments} value={null} onChange={onChange} />,
    );
    fireEvent.press(getByText('핀로딩'));
    expect(onChange).toHaveBeenCalledWith('pin');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange when pressing the active segment', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <SegmentedControl segments={segments} value="pin" onChange={onChange} />,
    );
    fireEvent.press(getByText('핀로딩'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('forwards testID to the container', () => {
    const { getByTestId } = render(
      <SegmentedControl
        segments={segments}
        value={null}
        onChange={() => undefined}
        testID="loading-type-segmented"
      />,
    );
    expect(getByTestId('loading-type-segmented')).toBeTruthy();
  });
});
