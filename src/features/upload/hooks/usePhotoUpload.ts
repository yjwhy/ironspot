import { useState } from 'react';

import type { MachineTemplateSuggestion, PhotoUploadResponse } from '@/shared/generated/model';
import { useUpload } from '@/shared/generated/photos/photos';

type SuggestionPreview = Pick<MachineTemplateSuggestion, 'id' | 'brandName' | 'name'>;

interface UploadResult {
  photoId: string;
  photoUrl: string;
  ocrSucceeded: boolean;
  suggestions: SuggestionPreview[];
}

interface UsePhotoUploadReturn {
  upload: () => Promise<void>;
  retry: () => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: Error | null;
  result: UploadResult | null;
}

function stripScore(suggestion: MachineTemplateSuggestion): SuggestionPreview {
  return { id: suggestion.id, brandName: suggestion.brandName, name: suggestion.name };
}

function toUploadResult(data: PhotoUploadResponse): UploadResult {
  return {
    photoId: data.photoId,
    photoUrl: data.photoUrl,
    ocrSucceeded: data.ocrSucceeded,
    suggestions: data.suggestions.map(stripScore),
  };
}

export function usePhotoUpload(gymMachineId: string, compressedUri: string): UsePhotoUploadReturn {
  const { mutateAsync } = useUpload();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<Error | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function runUpload(): Promise<void> {
    setIsUploading(true);
    setUploadProgress(0.5);
    setUploadError(null);
    setResult(null);

    try {
      const response = await fetch(compressedUri);
      const blob = await response.blob();

      const uploadResponse = await mutateAsync({
        params: { gymMachineId },
        data: { image: blob },
      });

      setResult(toUploadResult(uploadResponse.data));
      setUploadProgress(1);
    } catch (error) {
      setUploadError(error instanceof Error ? error : new Error('Upload failed'));
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  }

  return {
    upload: runUpload,
    retry: runUpload,
    isUploading,
    uploadProgress,
    uploadError,
    result,
  };
}
