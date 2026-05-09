import type { PhotoResponse } from '@/shared/generated/model';
import { listPhotos } from '@/shared/generated/photos/photos';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import type { MachinePhoto } from '@/shared/types/database';

export function toMachinePhoto(r: PhotoResponse): MachinePhoto {
  return {
    id: r.id,
    gym_machine_id: r.gymMachineId,
    user_id: r.userId,
    photo_url: r.photoUrl,
    upvote_count: r.upvoteCount,
    created_at: r.createdAt,
  };
}

export async function getMachinePhotos(gymMachineId: string): Promise<MachinePhoto[]> {
  const result = unwrapOrvalResponse(await listPhotos(gymMachineId));
  return result.map(toMachinePhoto);
}
