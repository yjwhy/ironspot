import { renderHook, waitFor } from '@testing-library/react-native';

import type { MachineTemplateResponse } from '@/shared/generated/model';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { fetchMachineTemplates } from '../../services/machine-templates';
import { useMachineTemplates } from '../useMachineTemplates';

jest.mock('../../services/machine-templates', () => ({
  fetchMachineTemplates: jest.fn(),
}));

const mockFetch = fetchMachineTemplates as jest.MockedFunction<typeof fetchMachineTemplates>;

describe('useMachineTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls fetchMachineTemplates and returns data on success', async () => {
    const templates: MachineTemplateResponse[] = [
      {
        id: 't1',
        brandId: 'b1',
        brandName: 'Panatta',
        brandNameKo: '',
        categoryId: 'c1',
        nameEn: 'High Row',
        nameKo: 'High Row',
        loadingType: 'pin',
      },
    ];
    mockFetch.mockResolvedValue(templates);
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useMachineTemplates(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(templates);
  });

  it('sorts by brand name then template name using Korean locale', async () => {
    const unsorted: MachineTemplateResponse[] = [
      {
        id: 't1',
        brandId: 'b1',
        brandName: 'Panatta',
        brandNameKo: '',
        categoryId: 'c1',
        nameEn: 'Low Row',
        nameKo: 'Low Row',
        loadingType: 'plate',
      },
      {
        id: 't2',
        brandId: 'b2',
        brandName: 'Hammer Strength',
        brandNameKo: '',
        categoryId: 'c2',
        nameEn: 'MTS Chest Press',
        nameKo: 'MTS Chest Press',
        loadingType: 'pin',
      },
      {
        id: 't3',
        brandId: 'b1',
        brandName: 'Panatta',
        brandNameKo: '',
        categoryId: 'c1',
        nameEn: 'High Row',
        nameKo: 'High Row',
        loadingType: 'pin',
      },
      {
        id: 't4',
        brandId: 'b3',
        brandName: '하이짐',
        brandNameKo: '',
        categoryId: 'c3',
        nameEn: 'Squat',
        nameKo: 'Squat',
        loadingType: 'plate',
      },
    ];
    mockFetch.mockResolvedValue(unsorted);
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useMachineTemplates(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Korean locale: Hangul (하이짐) comes before Latin (Hammer, Panatta).
    // Within same brand: alphabetical by template name (Panatta: High Row < Low Row).
    expect(result.current.data?.map((t) => `${t.brandName} ${t.nameEn}`)).toEqual([
      '하이짐 Squat',
      'Hammer Strength MTS Chest Press',
      'Panatta High Row',
      'Panatta Low Row',
    ]);
  });

  it('exposes an error state when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useMachineTemplates(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
