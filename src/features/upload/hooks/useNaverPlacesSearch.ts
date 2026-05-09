function noopSearch(): void {
  return;
}

export function useNaverPlacesSearch() {
  return { search: noopSearch, results: [], isLoading: false };
}
