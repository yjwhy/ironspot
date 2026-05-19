import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { OAuthButton } from '../OAuthButton';

describe('OAuthButton', () => {
  it('renders the provider label', () => {
    const { getByText } = render(
      <OAuthButton provider="google" label="Google로 계속하기" onPress={() => undefined} />,
    );
    expect(getByText('Google로 계속하기')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <OAuthButton provider="kakao" label="Kakao로 계속하기" onPress={onPress} />,
    );
    fireEvent.press(getByRole('button', { name: 'Kakao로 계속하기' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner and disables press while loading', () => {
    const onPress = jest.fn();
    const { getByRole, queryByText } = render(
      <OAuthButton provider="apple" label="Apple로 계속하기" onPress={onPress} loading={true} />,
    );
    expect(queryByText('Apple로 계속하기')).toBeNull();
    fireEvent.press(getByRole('button', { name: 'Apple로 계속하기' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
