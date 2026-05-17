export const ADMIN_ROUTES = {
  queue: '/admin/queue',
  photo: (photoId: string) => `/admin/photo/${photoId}` as const,
  // ADR 0022 follow-up (Task 46) Slice 46h
  gymMachine: (gymMachineId: string) => `/admin/gym-machine/${gymMachineId}` as const,
} as const;
