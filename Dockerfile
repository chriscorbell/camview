# camview - single-container RTSP to WebRTC live camera viewer.
#
# Built on the official go2rtc image (Alpine + go2rtc binary + ffmpeg),
# with nginx added to serve the camview frontend and proxy WebRTC signaling.
FROM node:24-alpine AS web-build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY src/ ./src/
RUN npm run build

FROM alexxit/go2rtc:latest

USER root

RUN apk add --no-cache nginx \
    && rm -rf /var/cache/apk/*

# go2rtc config (reads CAMERA_RTSP_URL / WEBRTC_CANDIDATE from env at runtime).
COPY go2rtc.yaml /config/go2rtc.yaml

# nginx config + compiled static frontend.
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=web-build /app/dist/ /var/www/camview/

# Process supervisor.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 8080 = web UI + signaling (HTTP/WS). 8555 = WebRTC media (TCP+UDP).
EXPOSE 8080 8555/tcp 8555/udp

ENTRYPOINT ["/entrypoint.sh"]
