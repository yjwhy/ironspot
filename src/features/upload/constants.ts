import { SaveFormat } from 'expo-image-manipulator';

// Single source of truth for the upload image format: every reader (compression in
// UploadPhotoScreen, multipart part metadata in usePhotoUpload, tests asserting the
// MIME) derives from these constants so the format choice can be changed in one place.
export const UPLOAD_IMAGE_FORMAT = SaveFormat.WEBP;
export const PHOTO_FILENAME = 'photo.webp';
export const PHOTO_MIME_TYPE = 'image/webp';

// Maximum OCR suggestions surfaced on UploadConfirmScreen's OcrSuccessView.
// The backend caps the suggestion list (FuzzyMatchService top-N) but the UI
// also slices defensively so a future server-side widening does not regress
// the launch UX of "at most 3 radio rows".
export const MAX_OCR_SUGGESTIONS = 3;

// Single source of truth for the upload-camera pathname. Production callers
// (GymDetail FAB, MachinePhotoGalleryScreen FAB, UploadGymSelectScreen) plus
// the matching test assertions import this so a future route rename only
// touches one location and the typed-routes guarantee stays intact.
export const UPLOAD_PHOTO_PATHNAME = '/(upload)/photo' as const;
