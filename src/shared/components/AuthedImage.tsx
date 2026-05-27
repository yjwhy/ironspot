import { Image, type ImageProps } from 'expo-image';

import { useAuthedImageSource } from '@/shared/hooks/useAuthedImageSource';

export interface AuthedImageProps extends Omit<ImageProps, 'source'> {
  /** Relative proxy path from a photo DTO, e.g. `/api/photos/{id}/content`. */
  contentPath: string | null | undefined;
}

/**
 * Security A3 Phase 2c: expo-image that loads a photo through the authenticated
 * proxy (contentPath + Bearer header) instead of a long-lived signed URL.
 * Drop-in replacement for `<Image source={{ uri: photoUrl }} />` — pass
 * `contentPath` instead of building a `source`. Renders the placeholder until
 * the auth token resolves.
 */
export function AuthedImage({ contentPath, ...rest }: AuthedImageProps) {
  const source = useAuthedImageSource(contentPath);
  return <Image source={source} {...rest} />;
}
