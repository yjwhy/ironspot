import { supabase } from '@/shared/lib/supabase';
import { unwrapList } from '@/shared/lib/supabase-helpers';
import type { MachinePhoto } from '@/shared/types/database';

/**
 * Returns all photos for a machine ordered by upvote_count descending so the
 * "best cut" is first. Used by useMachinePhotos in the photo gallery screen.
 */
export async function getMachinePhotos(gymMachineId: string): Promise<MachinePhoto[]> {
  const response = await supabase
    .from('machine_photos')
    .select('*')
    .eq('gym_machine_id', gymMachineId)
    .order('upvote_count', { ascending: false });
  return unwrapList<MachinePhoto>(response);
}
