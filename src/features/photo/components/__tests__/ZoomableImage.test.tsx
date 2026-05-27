import { render } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { ZoomableImage } from '../ZoomableImage';

describe('ZoomableImage', () => {
  it('renders exactly one Image', () => {
    const { UNSAFE_getAllByType } = render(
      <ZoomableImage contentPath="/api/photos/p1/content" width={300} height={400} />,
    );
    expect(UNSAFE_getAllByType(Image)).toHaveLength(1);
  });

  it('exposes accessibilityRole="image" on the wrapper', () => {
    const { getByRole } = render(
      <ZoomableImage contentPath="/api/photos/p1/content" width={300} height={400} />,
    );
    expect(getByRole('image')).toBeTruthy();
  });

  it('forwards an accessibilityLabel when provided', () => {
    const { getByLabelText } = render(
      <ZoomableImage
        contentPath="/api/photos/p1/content"
        width={300}
        height={400}
        accessibilityLabel="머신 사진 1번"
      />,
    );
    expect(getByLabelText('머신 사진 1번')).toBeTruthy();
  });
});
