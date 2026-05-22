// Phase 5 item 11 slice (d): discriminated upload error state. Owned at
// the feature boundary so the hook (`usePhotoUpload`) and the screen
// (`UploadConfirmScreen` + its inline error views) can share the same
// contract without one taking ownership over the other.
//
// `quota` fires when the orphan-upload rate limiter (PhotoService
// HOURLY_ORPHAN_LIMIT) rejects an unbound upload with 429. `generic`
// covers every other failure mode (network, server 5xx, 4xx for
// malformed input) and preserves the original Error for Sentry forensics.
export type UploadErrorState = { kind: 'quota' } | { kind: 'generic'; error: Error };
