import { afterEach } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { resetPhotoGuidanceForTests } from '../../lib/guidance-storage';
import { PhotoGuidanceBanner, PhotoGuidanceHintStrip } from '../PhotoCaptureGuidance';

afterEach(function clearGuidanceState() {
  resetPhotoGuidanceForTests();
});

describe('PhotoGuidanceHintStrip', () => {
  it('renders the always-visible brand/model label reminder', () => {
    render(<PhotoGuidanceHintStrip />);
    expect(screen.getByText(/브랜드.*모델명 적힌 라벨/)).toBeTruthy();
  });
});

describe('PhotoGuidanceBanner', () => {
  it('renders on first mount with example image + dismiss button', () => {
    render(<PhotoGuidanceBanner />);
    expect(screen.getByTestId('photo-guidance-banner')).toBeTruthy();
    expect(screen.getByTestId('photo-guidance-example-image')).toBeTruthy();
    expect(screen.getByTestId('photo-guidance-banner-dismiss')).toBeTruthy();
  });

  it('hides after the user taps "알겠어요" within the same mount', () => {
    render(<PhotoGuidanceBanner />);
    fireEvent.press(screen.getByTestId('photo-guidance-banner-dismiss'));
    expect(screen.queryByTestId('photo-guidance-banner')).toBeNull();
  });

  it('stays hidden on a fresh mount once dismissed (MMKV persistence)', () => {
    const first = render(<PhotoGuidanceBanner />);
    fireEvent.press(screen.getByTestId('photo-guidance-banner-dismiss'));
    first.unmount();

    render(<PhotoGuidanceBanner />);
    expect(screen.queryByTestId('photo-guidance-banner')).toBeNull();
  });
});
