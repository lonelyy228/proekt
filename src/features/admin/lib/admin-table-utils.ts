export const countActiveFilters = (flags: boolean[]): number => flags.filter(Boolean).length;

export const toTrimmedOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const buildQueryString = (params: Array<[string, string | undefined]>): string => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of params) {
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  return searchParams.toString();
};
