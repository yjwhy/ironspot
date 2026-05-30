import { fireEvent, render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Pressable, Text } from 'react-native';

import { SearchableList } from '../SearchableList';

const TEST_ID = 'brand';

function renderList(overrides: Partial<ComponentProps<typeof SearchableList>> = {}) {
  const onChangeQuery = jest.fn();
  const onSelectRow = jest.fn();
  const utils = render(
    <SearchableList
      testIDPrefix={TEST_ID}
      searchPlaceholder="브랜드 검색"
      query=""
      onChangeQuery={onChangeQuery}
      rows={[
        { id: 'a', label: '해머 스트렝스 (Hammer Strength)' },
        { id: 'b', label: '라이프 피트니스 (Life Fitness)' },
      ]}
      selectedRowId={null}
      onSelectRow={onSelectRow}
      emptyMessage="등록된 항목이 없어요"
      proposeNew={null}
      {...overrides}
    />,
  );
  return { ...utils, onChangeQuery, onSelectRow };
}

describe('SearchableList', () => {
  it('renders one option per row', () => {
    const { getByTestId } = renderList();
    expect(getByTestId(`${TEST_ID}-option-a`)).toBeTruthy();
    expect(getByTestId(`${TEST_ID}-option-b`)).toBeTruthy();
  });

  it('emits onChangeQuery when the search box is typed in', () => {
    const { getByTestId, onChangeQuery } = renderList();
    fireEvent.changeText(getByTestId(`${TEST_ID}-search`), '해머');
    expect(onChangeQuery).toHaveBeenCalledWith('해머');
  });

  it('emits onSelectRow with the row id when an option is tapped', () => {
    const { getByTestId, onSelectRow } = renderList();
    fireEvent.press(getByTestId(`${TEST_ID}-option-b`));
    expect(onSelectRow).toHaveBeenCalledWith('b');
  });

  it('marks the selected row as checked', () => {
    const { getByTestId } = renderList({ selectedRowId: 'a' });
    expect(getByTestId(`${TEST_ID}-option-a`)).toHaveProp('accessibilityState', {
      checked: true,
    });
    expect(getByTestId(`${TEST_ID}-option-b`)).toHaveProp('accessibilityState', {
      checked: false,
    });
  });

  it('shows the empty message when rows is empty and no proposeNew', () => {
    const { getByTestId } = renderList({ rows: [] });
    expect(getByTestId(`${TEST_ID}-empty`)).toBeTruthy();
  });

  it('renders the proposeNew row and forwards taps', () => {
    const proposeOnSelect = jest.fn();
    const { getByTestId } = renderList({
      rows: [],
      proposeNew: {
        label: '"Cybex" 신규 브랜드로 등록 요청',
        isSelected: false,
        onSelect: proposeOnSelect,
      },
    });
    fireEvent.press(getByTestId(`${TEST_ID}-propose-new`));
    expect(proposeOnSelect).toHaveBeenCalledTimes(1);
  });

  it('marks the proposeNew row as checked when isSelected', () => {
    const { getByTestId } = renderList({
      rows: [],
      proposeNew: {
        label: '"Cybex" 신규 브랜드로 등록 요청',
        isSelected: true,
        onSelect: jest.fn(),
      },
    });
    expect(getByTestId(`${TEST_ID}-propose-new`)).toHaveProp('accessibilityState', {
      checked: true,
    });
  });

  it('shows the loading spinner instead of the empty message while loading', () => {
    const { getByTestId, queryByTestId } = renderList({ rows: [], isLoading: true });
    expect(getByTestId(`${TEST_ID}-loading`)).toBeTruthy();
    expect(queryByTestId(`${TEST_ID}-empty`)).toBeNull();
  });

  it('hides the proposeNew row while loading even when a query has been typed', () => {
    const { queryByTestId } = renderList({
      rows: [],
      isLoading: true,
      proposeNew: {
        label: '"Cybex" 신규 브랜드로 등록 요청',
        isSelected: false,
        onSelect: jest.fn(),
      },
    });
    expect(queryByTestId(`${TEST_ID}-propose-new`)).toBeNull();
  });

  it('renders a trailing control per row when renderTrailing is provided', () => {
    const { getByTestId } = renderList({
      renderTrailing: (row) => <Text testID={`${TEST_ID}-trailing-${row.id}`}>사진</Text>,
    });
    expect(getByTestId(`${TEST_ID}-trailing-a`)).toBeTruthy();
    expect(getByTestId(`${TEST_ID}-trailing-b`)).toBeTruthy();
  });

  it('tapping the trailing control does NOT select the row', () => {
    const onTrailingPress = jest.fn();
    const { getByTestId, onSelectRow } = renderList({
      renderTrailing: (row) => (
        <Pressable testID={`${TEST_ID}-trailing-${row.id}`} onPress={onTrailingPress}>
          <Text>사진</Text>
        </Pressable>
      ),
    });

    fireEvent.press(getByTestId(`${TEST_ID}-trailing-a`));

    expect(onTrailingPress).toHaveBeenCalledTimes(1);
    expect(onSelectRow).not.toHaveBeenCalled();
  });
});
