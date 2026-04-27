import { unwrapList, unwrapSingle } from '../supabase-helpers';

interface Row {
  id: string;
  name: string;
}

describe('unwrapList', () => {
  it('returns the data array on success', () => {
    const rows: Row[] = [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
    ];

    const result = unwrapList<Row>({ data: rows, error: null });

    expect(result).toEqual(rows);
  });

  it('returns [] when data is null and there is no error', () => {
    const result = unwrapList<Row>({ data: null, error: null });

    expect(result).toEqual([]);
  });

  it('throws an Error containing the error message when error is present', () => {
    expect(() => unwrapList<Row>({ data: null, error: { message: 'permission denied' } })).toThrow(
      'permission denied',
    );
  });
});

describe('unwrapSingle', () => {
  it('returns the row on success', () => {
    const row: Row = { id: '1', name: 'a' };

    const result = unwrapSingle<Row>({ data: row, error: null });

    expect(result).toEqual(row);
  });

  it('returns null when data is null and there is no error', () => {
    const result = unwrapSingle<Row>({ data: null, error: null });

    expect(result).toBeNull();
  });

  it('throws an Error containing the error message when error is present', () => {
    expect(() => unwrapSingle<Row>({ data: null, error: { message: 'not found' } })).toThrow(
      'not found',
    );
  });
});
