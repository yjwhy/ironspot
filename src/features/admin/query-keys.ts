export const adminKeys = {
  all: ['admin'] as const,
  pendingPhotos: () => [...adminKeys.all, 'pendingPhotos'] as const,
  photoDetail: (photoId: string) => [...adminKeys.all, 'photo', photoId] as const,
} as const;
