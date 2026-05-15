import { fireEvent, render } from '@testing-library/react-native';

import { InterpretationChip } from '../InterpretationChip';

describe('InterpretationChip', () => {
  it('renders the parsed-interpretation text', () => {
    const { getByText } = render(
      <InterpretationChip text="강남역 1km 안 / 파나타 3개" onClose={() => undefined} />,
    );
    expect(getByText('강남역 1km 안 / 파나타 3개')).toBeTruthy();
  });

  it('calls onClose when the X button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <InterpretationChip text="강남역 1km 안" onClose={onClose} />,
    );
    fireEvent.press(getByLabelText('검색 종료'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
