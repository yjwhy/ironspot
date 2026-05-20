import { fireEvent, render } from '@testing-library/react-native';

import { UNDO_TOAST_DURATION_MS, UndoRegistrationToast } from '../UndoRegistrationToast';

const mockHandleUndo = jest.fn();
let mockIsVisible = true;
let mockIsPending = false;

jest.mock('../../hooks/useUndoRegistration', () => ({
  useUndoRegistration: jest.fn(() => ({
    isVisible: mockIsVisible,
    isPending: mockIsPending,
    handleUndo: mockHandleUndo,
  })),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('UndoRegistrationToast', () => {
  beforeEach(() => {
    mockHandleUndo.mockClear();
    mockIsVisible = true;
    mockIsPending = false;
  });

  it('renders the gym name with the registration confirmation copy', () => {
    const view = render(<UndoRegistrationToast gymId="gym-1" gymName="에어짐 강남" />);

    expect(view.getByTestId('undo-registration-toast')).toBeTruthy();
    expect(view.getByText(/에어짐 강남/)).toBeTruthy();
  });

  it('fires handleUndo when the cancel button is pressed', () => {
    const { getByTestId } = render(<UndoRegistrationToast gymId="gym-1" gymName="에어짐 강남" />);
    fireEvent.press(getByTestId('undo-registration-toast-cancel'));
    expect(mockHandleUndo).toHaveBeenCalledTimes(1);
  });

  it('returns null when the hook says the toast is no longer visible', () => {
    mockIsVisible = false;
    const { queryByTestId } = render(<UndoRegistrationToast gymId="gym-1" gymName="에어짐 강남" />);
    expect(queryByTestId('undo-registration-toast')).toBeNull();
  });

  it('shows a "취소 중..." label and disables the button while the mutation is pending', () => {
    mockIsPending = true;
    const { getByTestId, getByText } = render(
      <UndoRegistrationToast gymId="gym-1" gymName="에어짐 강남" />,
    );
    expect(getByText('취소 중...')).toBeTruthy();
    expect(getByTestId('undo-registration-toast-cancel')).toHaveProp('accessibilityState', {
      disabled: true,
    });
  });

  it('exports a 5000ms duration constant matching the design spec', () => {
    expect(UNDO_TOAST_DURATION_MS).toBe(5000);
  });
});
