import { useState } from 'react';

import type {
  MachineTemplateSuggestion,
  OcrOnlyResponse,
  PhotoUploadResponse,
} from '@/shared/generated/model';
import { useAnalyzeForOcrOnly, useUpload } from '@/shared/generated/photos/photos';
import { HTTPError } from '@/shared/lib/api-client';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

import { PHOTO_FILENAME, PHOTO_MIME_TYPE } from '../constants';
import type { UploadErrorState } from '../types';

export type SuggestionPreview = Pick<
  MachineTemplateSuggestion,
  'id' | 'brandName' | 'nameEn' | 'nameKo'
>;

const UPLOAD_STARTED_PROGRESS = 0.5;

// Phase 5 follow-up G: photoId / photoUrl are only populated on the
// existing-machine path (POST /api/photos/upload). The new-machine path
// goes through /api/photos/ocr-only and leaves them undefined — the
// whole-machine capture step later in the flow produces the real photo
// row. Splitting the union keeps consumers explicit about which path
// produced the result so they don't accidentally bind to a label-photo
// id that doesn't exist on the BE.
export type UploadResult =
  | {
      kind: 'bound';
      photoId: string;
      photoUrl: string;
      ocrSucceeded: boolean;
      suggestions: SuggestionPreview[];
    }
  | {
      kind: 'ocrOnly';
      ocrSucceeded: boolean;
      suggestions: SuggestionPreview[];
    };

interface UsePhotoUploadReturn {
  upload: () => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: UploadErrorState | null;
  result: UploadResult | null;
}

function classifyUploadError(error: unknown): UploadErrorState {
  if (error instanceof HTTPError && error.response.status === 429) {
    return { kind: 'quota' };
  }
  return {
    kind: 'generic',
    error: error instanceof Error ? error : new Error('Upload failed'),
  };
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
  return {
    id: suggestion.id,
    brandName: suggestion.brandName,
    nameEn: suggestion.nameEn,
    nameKo: suggestion.nameKo,
  };
}

function toBoundResult(data: PhotoUploadResponse): UploadResult {
  return {
    kind: 'bound',
    photoId: data.photoId,
    photoUrl: data.photoUrl,
    ocrSucceeded: data.ocrSucceeded,
    suggestions: data.suggestions.map(stripScore),
  };
}

function toOcrOnlyResult(data: OcrOnlyResponse): UploadResult {
  return {
    kind: 'ocrOnly',
    ocrSucceeded: data.ocrSucceeded,
    suggestions: data.suggestions.map(stripScore),
  };
}

// Phase 5 follow-up G: split mutation by entry point.
//
// - `gymMachineId` set → existing-machine photo-add (gallery, owner). Use
//   the legacy `POST /api/photos/upload` so the photo lands in
//   machine_photos and binds to the known gym_machine row.
// - `gymMachineId` undefined → new-machine registration. Use
//   `POST /api/photos/ocr-only` to read suggestions without writing
//   Storage/DB; the whole-machine capture step later in the flow does
//   the real upload + machine creation.
export function usePhotoUpload(
  gymMachineId: string | undefined,
  compressedUri: string,
): UsePhotoUploadReturn {
  const { mutateAsync: uploadMutate } = useUpload();
  const { mutateAsync: ocrOnlyMutate } = useAnalyzeForOcrOnly();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<UploadErrorState | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function runUpload(): Promise<void> {
    setIsUploading(true);
    setUploadProgress(UPLOAD_STARTED_PROGRESS);
    setUploadError(null);
    setResult(null);

    try {
      const imageData = {
        image: toRnMultipartFile(compressedUri) as unknown as Blob,
      };

      if (gymMachineId !== undefined) {
        const uploadResponse = await uploadMutate({
          params: { gymMachineId },
          data: imageData,
        });
        setResult(toBoundResult(unwrapOrvalResponse(uploadResponse)));
      } else {
        const ocrResponse = await ocrOnlyMutate({ data: imageData });
        setResult(toOcrOnlyResult(unwrapOrvalResponse(ocrResponse)));
      }
      setUploadProgress(1);
    } catch (error) {
      setUploadError(classifyUploadError(error));
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
