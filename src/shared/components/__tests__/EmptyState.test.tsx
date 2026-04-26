import { MaterialIcons } from '@expo/vector-icons';
import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '../Button';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    const { getByText } = render(
      <EmptyState
        icon="search-off"
        title="조건에 맞는 헬스장이 없어요"
        description="필터를 조정해보세요"
      />,
    );
    expect(getByText('조건에 맞는 헬스장이 없어요')).toBeTruthy();
    expect(getByText('필터를 조정해보세요')).toBeTruthy();
  });

  it('renders without a description', () => {
    const { getByText, queryByText } = render(<EmptyState icon="info" title="비어 있어요" />);
    expect(getByText('비어 있어요')).toBeTruthy();
    expect(queryByText('필터를 조정해보세요')).toBeNull();
  });

  it('mounts the MaterialIcons glyph passed via the icon prop', () => {
    const { UNSAFE_queryAllByType } = render(<EmptyState icon="search-off" title="비어 있어요" />);
    expect(UNSAFE_queryAllByType(MaterialIcons)).toHaveLength(1);
  });

  it('does not render an action wrapper when action prop is omitted', () => {
    const { queryByText } = render(<EmptyState icon="info" title="비어 있어요" />);
    expect(queryByText('필터 초기화')).toBeNull();
  });

  it('groups title and description under one accessibility label', () => {
    const { getByTestId } = render(
      <EmptyState
        testID="empty"
        icon="info"
        title="조건에 맞는 헬스장이 없어요"
        description="필터를 조정해보세요"
      />,
    );
    expect(getByTestId('empty')).toHaveProp(
      'accessibilityLabel',
      '조건에 맞는 헬스장이 없어요. 필터를 조정해보세요',
    );
  });

  it('renders an action when provided and forwards interaction', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        icon="search-off"
        title="비어 있어요"
        action={<Button label="필터 초기화" onPress={onPress} />}
      />,
    );
    fireEvent.press(getByText('필터 초기화'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('forwards testID', () => {
    const { getByTestId } = render(<EmptyState testID="empty" icon="info" title="비어 있어요" />);
    expect(getByTestId('empty')).toBeTruthy();
  });
});
