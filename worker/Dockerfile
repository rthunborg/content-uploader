FROM mwader/static-ffmpeg:8.1.2 AS ffmpeg

FROM node:22-bookworm-slim

COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe

WORKDIR /app
COPY worker ./worker
COPY src/shared ./src/shared

USER node

ENTRYPOINT ["node", "worker/index.ts"]
