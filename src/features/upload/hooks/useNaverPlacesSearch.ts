// eslint-disable-next-line @typescript-eslint/no-empty-function
function noopSearch() {}

export function useNaverPlacesSearch() {
  return { search: noopSearch, results: [], isLoading: false };
}
