interface OrderResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export function createSupabaseFromMock(): jest.Mock {
  return jest.fn();
}

/**
 * Build a chained supabase mock for `from(table).select(...).order(...)`
 * resolving to the provided result.
 */
export function mockFromOrderResult<T>(
  mockFrom: jest.Mock,
  result: OrderResult<T>,
): { select: jest.Mock; order: jest.Mock } {
  const order = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ order });
  mockFrom.mockReturnValue({ select });
  return { select, order };
}
