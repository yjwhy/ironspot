import { fireEvent, render } from '@testing-library/react-native';

import { FilterSheetSection } from '../FilterSheetSection';

const items = [
  { id: 'b1', name: 'Hammer Strength' },
  { id: 'b2', name: 'Panatta' },
  { id: 'b3', name: 'Cybex' },
  { id: 'b4', name: 'Life Fitness' },
  { id: 'b5', name: 'Technogym' },
  { id: 'b6', name: 'Matrix' },
  { id: 'b7', name: 'Atlantis' },
  { id: 'b8', name: 'Body-Solid' },
];

describe('FilterSheetSection', () => {
  it('renders the section label and selection count', () => {
    const { getByText } = render(
      <FilterSheetSection
        label="브랜드"
        items={items}
        selectedIds={['b1', 'b3']}
        onToggle={() => undefined}
      />,
    );
    expect(getByText('브랜드')).toBeTruthy();
    expect(getByText('2 / 8')).toBeTruthy();
  });

  it('renders every item as a chip when below search threshold', () => {
    const small = items.slice(0, 3);
    const { getByText, queryByPlaceholderText } = render(
      <FilterSheetSection
        label="머신 종류"
        items={small}
        selectedIds={[]}
        searchThreshold={8}
        onToggle={() => undefined}
      />,
    );
    expect(getByText('Hammer Strength')).toBeTruthy();
    expect(getByText('Panatta')).toBeTruthy();
    expect(getByText('Cybex')).toBeTruthy();
    expect(queryByPlaceholderText('검색')).toBeNull();
  });

  it('shows search input when items count meets the threshold', () => {
    const { getByPlaceholderText } = render(
      <FilterSheetSection
        label="브랜드"
        items={items}
        selectedIds={[]}
        searchThreshold={8}
        searchPlaceholder="브랜드 검색"
        onToggle={() => undefined}
      />,
    );
    expect(getByPlaceholderText('브랜드 검색')).toBeTruthy();
  });

  it('filters items by case-insensitive substring match on input', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <FilterSheetSection
        label="브랜드"
        items={items}
        selectedIds={[]}
        searchThreshold={8}
        searchPlaceholder="브랜드 검색"
        onToggle={() => undefined}
      />,
    );
    fireEvent.changeText(getByPlaceholderText('브랜드 검색'), 'ham');
    expect(getByText('Hammer Strength')).toBeTruthy();
    expect(queryByText('Panatta')).toBeNull();
    expect(queryByText('Cybex')).toBeNull();
  });

  it('shows a no-result message when search yields no matches', () => {
    const { getByPlaceholderText, getByText } = render(
      <FilterSheetSection
        label="브랜드"
        items={items}
        selectedIds={[]}
        searchThreshold={8}
        searchPlaceholder="브랜드 검색"
        onToggle={() => undefined}
      />,
    );
    fireEvent.changeText(getByPlaceholderText('브랜드 검색'), 'zzzz');
    expect(getByText('검색 결과가 없어요')).toBeTruthy();
  });

  it('calls onToggle with the chip id when a chip is pressed', () => {
    const onToggle = jest.fn();
    const { getByText } = render(
      <FilterSheetSection label="브랜드" items={items} selectedIds={[]} onToggle={onToggle} />,
    );
    fireEvent.press(getByText('Hammer Strength'));
    expect(onToggle).toHaveBeenCalledWith('b1');
  });

  it('shows error message when isError is true (precedence over empty)', () => {
    const { getByText, queryByText } = render(
      <FilterSheetSection
        label="브랜드"
        items={[]}
        selectedIds={[]}
        isError
        onToggle={() => undefined}
      />,
    );
    expect(getByText('필터를 불러올 수 없어요')).toBeTruthy();
    expect(queryByText('필터 항목이 없어요')).toBeNull();
  });

  it('shows empty message when items is empty and not errored', () => {
    const { getByText } = render(
      <FilterSheetSection label="브랜드" items={[]} selectedIds={[]} onToggle={() => undefined} />,
    );
    expect(getByText('필터 항목이 없어요')).toBeTruthy();
  });
});
