import { supabase } from '@/shared/lib/supabase';
import { unwrapList } from '@/shared/lib/supabase-helpers';
import type { GymMachineWithDetails } from '@/shared/types/database';

export const SELECT_WITH_DETAILS = `
  *,
  template:machine_templates (
    *,
    brand:brands (*),
    category:categories (*)
  ),
  photos:machine_photos (*)
` as const;

export async function getGymMachines(gymId: string): Promise<GymMachineWithDetails[]> {
  const response = await supabase
    .from('gym_machines')
    .select(SELECT_WITH_DETAILS)
    .eq('gym_id', gymId)
    .order('template_id');
  return unwrapList<GymMachineWithDetails>(response);
}
