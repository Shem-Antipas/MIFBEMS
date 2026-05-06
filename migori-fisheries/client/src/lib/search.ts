type SearchEmptyLabelOptions = {
  searchTerm: string;
  isLoading: boolean;
  loadingLabel: string;
  emptyLabel: string;
};

export const getSearchEmptyLabel = ({
  searchTerm,
  isLoading,
  loadingLabel,
  emptyLabel
}: SearchEmptyLabelOptions): string => {
  if (isLoading) {
    return loadingLabel;
  }

  const normalizedTerm = searchTerm.trim();
  if (normalizedTerm) {
    return `No search results found for "${normalizedTerm}".`;
  }

  return emptyLabel;
};
