import { render } from '@testing-library/react-native';
import { cancelAnimation } from 'react-native-reanimated';

import { UploadProgressBar } from '../UploadProgressBar';

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('react-native-reanimated/mock') as Record<string, unknown>;
  return {
    ...mock,
    cancelAnimation: jest.fn(),
  };
});

describe('UploadProgressBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<UploadProgressBar progress={0.5} />)).not.toThrow();
  });

  it('renders with progress=0 without errors', () => {
    expect(() => render(<UploadProgressBar progress={0} />)).not.toThrow();
  });

  it('renders with progress=0.5 without errors', () => {
    expect(() => render(<UploadProgressBar progress={0.5} />)).not.toThrow();
  });

  it('renders with progress=1 without errors', () => {
    expect(() => render(<UploadProgressBar progress={1} />)).not.toThrow();
  });

  it('calls cancelAnimation on unmount', () => {
    const { unmount } = render(<UploadProgressBar progress={0.5} />);
    unmount();
    expect(cancelAnimation).toHaveBeenCalled();
  });
});
