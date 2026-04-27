import { supabase } from '@/shared/lib/supabase';
import type { Category } from '@/shared/types/database';

export async function fetchCategories(): Promise<Category[]> {
  const response = await supabase.from('categories').select('*').order('name');
  const { data, error } = response as {
    data: Category[] | null;
    error: { message: string } | null;
  };
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
