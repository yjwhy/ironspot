import { listCategories } from '@/shared/generated/categories/categories';
import type { CategoryResponse } from '@/shared/generated/model';
import type { Category } from '@/shared/types/database';

export async function fetchCategories(): Promise<Category[]> {
  const result = (await listCategories()) as unknown as CategoryResponse[];
  return result;
}
