import { render } from '@testing-library/react-native';
import { cancelAnimation } from 'react-native-reanimated';

import { OcrScanAnimation } from '../OcrScanAnimation';

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('react-native-reanimated/mock') as Record<string, unknown>;
  return {
    ...mock,
    cancelAnimation: jest.fn(),
  };
});

describe('OcrScanAnimation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<OcrScanAnimation />)).not.toThrow();
  });

  it('calls cancelAnimation on unmount', () => {
    const { unmount } = render(<OcrScanAnimation />);
    unmount();
    expect(cancelAnimation).toHaveBeenCalled();
  });
});
