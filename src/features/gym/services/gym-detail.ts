import { supabase } from '@/shared/lib/supabase';
import { unwrapList, unwrapSingle } from '@/shared/lib/supabase-helpers';
import type { Gym, GymMachineWithDetails } from '@/shared/types/database';

export const SELECT_WITH_DETAILS = `
  *,
  template:machine_templates (
    *,
    brand:brands (*),
    category:categories (*)
  ),
  photos:machine_photos (*)
`;

export async function getGymMachines(gymId: string): Promise<GymMachineWithDetails[]> {
  const response = await supabase
    .from('gym_machines')
    .select(SELECT_WITH_DETAILS)
    .eq('gym_id', gymId)
    .order('template_id');
  return unwrapList<GymMachineWithDetails>(response);
}

export async function getGymById(gymId: string): Promise<Gym | null> {
  const response = await supabase.from('gyms').select('*').eq('id', gymId).maybeSingle();
  return unwrapSingle<Gym>(response);
}
