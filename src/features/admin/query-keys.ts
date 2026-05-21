export const adminKeys = {
  all: ['admin'] as const,
  pendingPhotos: () => [...adminKeys.all, 'pendingPhotos'] as const,
  pendingQueue: () => [...adminKeys.all, 'pendingQueue'] as const,
  pendingContributions: () => [...adminKeys.all, 'pendingContributions'] as const,
  gymMachineDetail: (gymMachineId: string) =>
    [...adminKeys.all, 'gymMachine', gymMachineId] as const,
  photoDetail: (photoId: string) => [...adminKeys.all, 'photo', photoId] as const,
} as const;
