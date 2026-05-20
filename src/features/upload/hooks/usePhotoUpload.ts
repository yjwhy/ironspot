import { useState } from 'react';

import type { MachineTemplateSuggestion, PhotoUploadResponse } from '@/shared/generated/model';
import { useUpload } from '@/shared/generated/photos/photos';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

import { PHOTO_FILENAME, PHOTO_MIME_TYPE } from '../constants';

export type SuggestionPreview = Pick<MachineTemplateSuggestion, 'id' | 'brandName' | 'name'>;

const UPLOAD_STARTED_PROGRESS = 0.5;

interface UploadResult {
  photoId: string;
  photoUrl: string;
  ocrSucceeded: boolean;
  suggestions: SuggestionPreview[];
}

interface UsePhotoUploadReturn {
  upload: () => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: Error | null;
  result: UploadResult | null;
}

// React Native's FormData accepts a `{ uri, name, type }` descriptor in place of a Blob
// and writes the multipart part with the correct filename + Content-Type. The previous
// `fetch(file://...).blob()` round-trip dropped the MIME type on iOS (blob.type === ''),
// which made the backend reject the upload before OCR could run and surfaced the
// "업로드 중 오류가 발생했어요" screen instead of the OCR result.
//
// The return type stays `RnFileDescriptor` so the helper is honest about its shape;
// the cast to `Blob` happens once at the FormData boundary where it is needed.
function toRnMultipartFile(uri: string): { uri: string; name: string; type: string } {
  return { uri, name: PHOTO_FILENAME, type: PHOTO_MIME_TYPE };
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

// Phase 5 item 11 slice 2: gymMachineId is optional. When omitted the photo
// lands as an orphan (machine_photos.gym_machine_id = NULL) and the OCR
// confirm screen's POST /api/gym-machines binds it to the new contribution
// row. Existing flows (machine photo gallery, owner workflow) keep passing
// gymMachineId and bypass the contribution path.
export function usePhotoUpload(
  gymMachineId: string | undefined,
  compressedUri: string,
): UsePhotoUploadReturn {
  const { mutateAsync } = useUpload();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<Error | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function runUpload(): Promise<void> {
    setIsUploading(true);
    setUploadProgress(UPLOAD_STARTED_PROGRESS);
    setUploadError(null);
    setResult(null);

    try {
      const uploadResponse = await mutateAsync({
        // Orval's UploadParams treats gymMachineId as optional; the generated
        // URL builder skips undefined entries so the orphan path emits
        // `/api/photos/upload` with no query string.
        params: gymMachineId !== undefined ? { gymMachineId } : {},
        data: { image: toRnMultipartFile(compressedUri) as unknown as Blob },
      });

      setResult(toUploadResult(unwrapOrvalResponse(uploadResponse)));
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
    isUploading,
    uploadProgress,
    uploadError,
    result,
  };
}
