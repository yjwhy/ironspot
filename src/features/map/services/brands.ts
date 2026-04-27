import { supabase } from '@/shared/lib/supabase';
import { unwrapList } from '@/shared/lib/supabase-helpers';
import type { Brand } from '@/shared/types/database';

export async function fetchBrands(): Promise<Brand[]> {
  const response = await supabase.from('brands').select('*').order('name');
  return unwrapList<Brand>(response);
}
