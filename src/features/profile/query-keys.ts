export const profileKeys = {
  myPhotos: (userId: string | null) => ['profile', 'my-photos', userId] as const,
  myVotes: (userId: string | null) => ['profile', 'my-votes', userId] as const,
};
