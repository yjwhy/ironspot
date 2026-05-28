import { render, screen } from '@testing-library/react-native';

import { PhotoGuidanceHintStrip } from '../PhotoCaptureGuidance';

// PhotoGuidanceBanner + its MMKV gating (`guidance-storage.ts`) were removed
// 2026-05-28 in favour of the on-demand LabelInfoSheet reached from the '?'
// button on both the upload-method-choice card and the camera viewfinder.
// The always-visible hint strip stays here because it provides framing
// coaching at the moment of capture and is too short to need its own sheet.

describe('PhotoGuidanceHintStrip', () => {
  it('renders the always-visible brand/model label reminder', () => {
    render(<PhotoGuidanceHintStrip />);
    expect(screen.getByText(/브랜드.*모델명 적힌 라벨/)).toBeTruthy();
  });
});
