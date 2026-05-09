import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import { useRequireAuth } from '@/features/auth/hooks/useRequireAuth';
import { removeUpvotePhoto, upvotePhoto } from '@/shared/generated/votes/votes';
import type { MachinePhoto } from '@/shared/types/database';

import { photoKeys } from '../query-keys';

const UPVOTE_ERROR_TITLE = '추천을 처리하지 못했어요';

/**
 * Optimistic upvote toggle for a photo.
 *
 * Returned `isUpvotedByMe` reflects the photo prop (used for rendering the
 * heart icon). The toggle decision inside `handleUpvote` reads from the
 * TanStack Query cache instead, so a quick second tap during the
 * settle→refetch gap (when the prop hasn't yet caught up to the optimistic
 * cache write) flips in the right direction.
 *
 * Errors are handled internally via burnt toast; the hook intentionally does
 * not expose `isError` / `error` to callers.
 */
export function useUpvote(photo: MachinePhoto) {
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const isUpvotedByMe = photo.is_upvoted_by_me ?? false;
  const listKey = photoKeys.list(photo.gym_machine_id);

  const mutation = useMutation<unknown, Error, boolean, { previous: MachinePhoto[] | undefined }>({
    mutationFn: async (isUpvoting) => {
      if (isUpvoting) {
        await upvotePhoto(photo.id);
      } else {
        await removeUpvotePhoto(photo.id);
      }
    },

    onMutate: async (isUpvoting) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<MachinePhoto[]>(listKey);
      // Skip optimistic write when cache is empty: writing [] would mask
      // the empty state and onError rollback would no-op silently.
      if (previous === undefined) return { previous };

      queryClient.setQueryData<MachinePhoto[]>(
        listKey,
        previous.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                upvote_count: p.upvote_count + (isUpvoting ? 1 : -1),
                is_upvoted_by_me: isUpvoting,
              }
            : p,
        ),
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(listKey, context.previous);
      }
      burnt.toast({ title: UPVOTE_ERROR_TITLE, preset: 'error' });
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  function handleUpvote() {
    requireAuth(() => {
      // Read current vote state from cache to avoid stale-closure races
      // when the photo prop hasn't yet updated from the list query.
      const current = queryClient
        .getQueryData<MachinePhoto[]>(listKey)
        ?.find((p) => p.id === photo.id);
      const currentlyVoted = current?.is_upvoted_by_me ?? isUpvotedByMe;
      mutation.mutate(!currentlyVoted);
    });
  }

  return { handleUpvote, isPending: mutation.isPending, isUpvotedByMe };
}
