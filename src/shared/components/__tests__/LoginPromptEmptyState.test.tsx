import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { LoginPromptEmptyState } from '../LoginPromptEmptyState';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const routerPushMock = router.push as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginPromptEmptyState', () => {
  it('renders the prompt title and default description', () => {
    const { getByText } = render(<LoginPromptEmptyState />);
    expect(getByText('로그인이 필요해요')).toBeTruthy();
    expect(getByText('내 사진과 추천 목록을 보려면 로그인하세요')).toBeTruthy();
  });

  it('renders the provided custom description', () => {
    const { getByText, queryByText } = render(
      <LoginPromptEmptyState description="관리자 화면은 로그인이 필요해요" />,
    );
    expect(getByText('관리자 화면은 로그인이 필요해요')).toBeTruthy();
    expect(queryByText('내 사진과 추천 목록을 보려면 로그인하세요')).toBeNull();
  });

  it('navigates to login when CTA is pressed', () => {
    const { getByRole } = render(<LoginPromptEmptyState />);
    fireEvent.press(getByRole('button', { name: '로그인하기' }));
    expect(routerPushMock).toHaveBeenCalledWith('/(auth)/login');
  });
});
