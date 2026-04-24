export const gymKeys = {
  all: ['gym'] as const,
  details: () => [...gymKeys.all, 'detail'] as const,
  detail: (gymId: string) => [...gymKeys.details(), gymId] as const,
  machines: (gymId: string) => [...gymKeys.detail(gymId), 'machines'] as const,
};
