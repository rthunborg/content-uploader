export const UPLOAD_CHUNK_SIZE = 6 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_AUDIO_DOCUMENT_BYTES = 200 * 1024 * 1024;

export const UPLOAD_RETRY_DELAYS = [0, 3_000, 5_000, 10_000, 20_000] as const;
