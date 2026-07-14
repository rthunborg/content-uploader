import { describe, expect, it } from "vitest";

import {
  MAX_AUDIO_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  UPLOAD_CHUNK_SIZE,
} from "./limits";

describe("upload limits", () => {
  it("keeps the canonical byte limits in one runtime-neutral module", () => {
    expect(UPLOAD_CHUNK_SIZE).toBe(6 * 1024 * 1024);
    expect(MAX_IMAGE_BYTES).toBe(50 * 1024 * 1024);
    expect(MAX_VIDEO_BYTES).toBe(2 * 1024 * 1024 * 1024);
    expect(MAX_AUDIO_DOCUMENT_BYTES).toBe(200 * 1024 * 1024);
  });
});
