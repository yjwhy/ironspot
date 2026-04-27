import { supabase } from '@/shared/lib/supabase';
import { unwrapList } from '@/shared/lib/supabase-helpers';
import type { Category } from '@/shared/types/database';

export async function fetchCategories(): Promise<Category[]> {
  const response = await supabase.from('categories').select('*').order('name');
  return unwrapList<Category>(response);
}
