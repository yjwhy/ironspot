interface ListResult<T> {
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
  result: ListResult<T>,
): { select: jest.Mock; order: jest.Mock } {
  const order = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ order });
  mockFrom.mockReturnValue({ select });
  return { select, order };
}

/**
 * Build a chained supabase mock for `from(table).select(sel).eq(col, val).order(col)`
 * resolving to the provided result.
 */
export function mockFromEqOrderResult<T>(
  mockFrom: jest.Mock,
  result: ListResult<T>,
): { select: jest.Mock; eq: jest.Mock; order: jest.Mock } {
  const order = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ order });
  const select = jest.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
  return { select, eq, order };
}

/**
 * Resolve a `supabase.rpc(...)` mock to the given list result. Use the same
 * pattern as `mockFromOrderResult` so service tests can stay symmetrical.
 */
export function mockRpcResult<T>(mockRpc: jest.Mock, result: ListResult<T>): jest.Mock {
  mockRpc.mockResolvedValue(result);
  return mockRpc;
}
