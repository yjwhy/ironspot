import { fireEvent, render } from '@testing-library/react-native';

import { SearchHistoryDropdown } from '../SearchHistoryDropdown';

jest.mock('burnt', () => ({ toast: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Warning: 'warning' },
}));

const noop = () => undefined;

describe('SearchHistoryDropdown', () => {
  it('renders EXAMPLE_QUERIES when history is empty', () => {
    const { getByText, queryByTestId } = render(
      <SearchHistoryDropdown
        entries={[]}
        onPick={noop}
        onFill={noop}
        onRemove={noop}
        onClearAll={noop}
      />,
    );
    expect(getByText('이런 검색을 해보세요')).toBeTruthy();
    expect(queryByTestId('search-history-dropdown')).toBeNull();
    expect(queryByTestId('search-history-empty')).toBeTruthy();
  });

  it('renders each history entry with its query string', () => {
    const entries = [{ query: '강남역 1km 안', at: Date.now() }];
    const { getByText, queryByTestId } = render(
      <SearchHistoryDropdown
        entries={entries}
        onPick={noop}
        onFill={noop}
        onRemove={noop}
        onClearAll={noop}
      />,
    );
    expect(queryByTestId('search-history-dropdown')).toBeTruthy();
    expect(getByText('강남역 1km 안')).toBeTruthy();
  });

  it('calls onPick with the entry query when the row text is tapped', () => {
    const onPick = jest.fn();
    const entries = [{ query: '강남역 1km 안', at: Date.now() }];
    const { getByText } = render(
      <SearchHistoryDropdown
        entries={entries}
        onPick={onPick}
        onFill={noop}
        onRemove={noop}
        onClearAll={noop}
      />,
    );
    fireEvent.press(getByText('강남역 1km 안'));
    expect(onPick).toHaveBeenCalledWith('강남역 1km 안');
  });

  it('calls onRemove with the entry query when the × button is tapped', () => {
    const onRemove = jest.fn();
    const entries = [{ query: '내 위치 500m', at: Date.now() }];
    const { getByLabelText } = render(
      <SearchHistoryDropdown
        entries={entries}
        onPick={noop}
        onFill={noop}
        onRemove={onRemove}
        onClearAll={noop}
      />,
    );
    fireEvent.press(getByLabelText('내 위치 500m 삭제'));
    expect(onRemove).toHaveBeenCalledWith('내 위치 500m');
  });
});
