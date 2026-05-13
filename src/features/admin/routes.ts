export const ADMIN_ROUTES = {
  queue: '/admin/queue',
  photo: (photoId: string) => `/admin/photo/${photoId}` as const,
} as const;
