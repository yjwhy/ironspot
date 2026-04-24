export const photoKeys = {
  all: ['photo'] as const,
  list: (gymMachineId: string) => [...photoKeys.all, 'list', gymMachineId] as const,
  detail: (photoId: string) => [...photoKeys.all, 'detail', photoId] as const,
};
