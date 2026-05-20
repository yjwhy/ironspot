import { SaveFormat } from 'expo-image-manipulator';

// Single source of truth for the upload image format: every reader (compression in
// UploadPhotoScreen, multipart part metadata in usePhotoUpload, tests asserting the
// MIME) derives from these constants so the format choice can be changed in one place.
export const UPLOAD_IMAGE_FORMAT = SaveFormat.WEBP;
export const PHOTO_FILENAME = 'photo.webp';
export const PHOTO_MIME_TYPE = 'image/webp';
