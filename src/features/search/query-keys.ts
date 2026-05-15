export const searchKeys = {
  all: ['search'] as const,
  recent: () => [...searchKeys.all, 'recent'] as const,
  results: (query: string) => [...searchKeys.all, 'results', query] as const,
};
