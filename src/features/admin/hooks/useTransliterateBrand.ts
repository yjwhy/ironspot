import { useMutation } from '@tanstack/react-query';
import { toast } from 'burnt';

import { apiClient } from '@/shared/lib/api-client';

interface TransliterateInput {
  name?: string;
  nameKo?: string;
}

export interface TransliterateResult {
  name: string;
  nameKo: string;
}

interface UseTransliterateBrandOptions {
  onSuccess: (result: TransliterateResult) => void;
}

// Mutation wrapper around POST /api/admin/transliterate-brand. The admin
// types one side of a new brand's EN/KO pair and taps "AI 제안"; the
// mutation calls Gemini Flash through the BE and the screen pre-fills the
// other field on success. Errors surface as a toast so the admin can fall
// back to typing both sides manually.
export function useTransliterateBrand({ onSuccess }: UseTransliterateBrandOptions) {
  return useMutation({
    mutationFn: async function fire(input: TransliterateInput): Promise<TransliterateResult> {
      return apiClient<TransliterateResult>('api/admin/transliterate-brand', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess,
    onError: function notify(error) {
      const message = error instanceof Error ? error.message : 'AI 제안을 가져오지 못했어요';
      toast({ title: message, preset: 'error' });
    },
  });
}
