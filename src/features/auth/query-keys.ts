export const userKeys = {
  all: ['users', 'me'] as const,
  me: (userId: string | null) => [...userKeys.all, userId] as const,
};
