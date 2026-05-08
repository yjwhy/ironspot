import { listBrands } from '@/shared/generated/brands/brands';
import type { BrandResponse } from '@/shared/generated/model';
import type { Brand } from '@/shared/types/database';

export async function fetchBrands(): Promise<Brand[]> {
  const result = (await listBrands()) as unknown as BrandResponse[];
  return result;
}
