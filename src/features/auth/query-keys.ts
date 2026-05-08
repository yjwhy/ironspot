export const userKeys = {
  me: (userId: string | null) => ['users', 'me', userId] as const,
};
