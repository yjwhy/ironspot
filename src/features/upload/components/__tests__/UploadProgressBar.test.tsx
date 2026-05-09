import { render } from '@testing-library/react-native';

import { UploadProgressBar } from '../UploadProgressBar';

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return
  return require('react-native-reanimated/mock');
});

describe('UploadProgressBar', () => {
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
});
