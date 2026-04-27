import { supabase } from '@/shared/lib/supabase';
import type { Brand } from '@/shared/types/database';

export async function fetchBrands(): Promise<Brand[]> {
  const response = await supabase.from('brands').select('*').order('name');
  const { data, error } = response as { data: Brand[] | null; error: { message: string } | null };
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
