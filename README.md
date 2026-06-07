# camview

**camview** is a single-container live viewer for an RTSP IP camera that optimizes for low latency.

Open it in a browser and it auto-connects and shows the feed over WebRTC (with an automatic MSE fallback).

Non-H.264 cameras are transcoded on the fly so any browser can play them (but you can optionally disable this).

## Docker Compose

Create a `compose.yaml` file: 

```
services:
  camview:
    image: ghcr.io/chriscorbell/camview:latest
    container_name: camview
    restart: unless-stopped
    ports:
      - "3147:8080"        # web UI + signaling WebSocket
      - "8555:8555/tcp"    # WebRTC media (only used if WEBRTC_CANDIDATE is set)
      - "8555:8555/udp"    # WebRTC media (only used if WEBRTC_CANDIDATE is set)
    environment:
      CAMERA_RTSP_URL: ${CAMERA_RTSP_URL}
      WEBRTC_CANDIDATE: ${WEBRTC_CANDIDATE:-}
```

Create a `.env` file in the same directory as `compose.yaml` (see `.env.example` for more details):

```
CAMERA_RTSP_URL=rtsp://user:pass@192.168.1.50:554/stream1
WEBRTC_CANDIDATE=192.168.1.10:8555
TRANSCODE=h264
HWACCEL=vaapi
```

### env vars

| Variable           | Default | Description                                                            |
| ------------------ | ------- | ---------------------------------------------------------------------- |
| `CAMERA_RTSP_URL`  | —       | **Required.** Full RTSP URL incl. credentials.                        |
| `WEBRTC_CANDIDATE` | —       | `"<server-lan-ip>:8555"` for true WebRTC; unset falls back to MSE.    |
| `TRANSCODE`        | `h264`  | `off` to pass the feed through (use with a native H.264 sub-stream).   |
| `HWACCEL`          | —       | GPU offload for the transcode: `vaapi`, `cuda`, `qsv`, …               |

Notes:
- **WebRTC vs MSE:** with bridge networking the container can't auto-detect a browser-reachable IP, so WebRTC needs `WEBRTC_CANDIDATE`. Without it, the player uses MSE over port 8080 — fine for most camera viewing, but higher latency than WebRTC
- **Hardware transcode:** set `HWACCEL` *and* pass the GPU through in `compose.yaml` (see the comments in dev.compose.yaml)
- Find your RTSP URL in the camera's app/manual; test it with `ffprobe "<url>"`
- LAN-only, no auth. **Don't expose to the internet**, use a VPN for remote access

## Tech stack & development

```
browser ──HTTP/WS :8080──▶ nginx ──▶ go2rtc :1984 (signaling)
   ▲                                     │
   └─────────── WebRTC media :8555 ◀─────┘  ◀── RTSP from camera
```

- **[go2rtc](https://github.com/AlexxIT/go2rtc)** — pulls the RTSP stream and serves it as WebRTC/MSE; runs the on-demand ffmpeg H.264 transcode
- **nginx** — serves the static UI and reverse-proxies the signaling WebSocket, so everything is on one port
- **`web/`** — the frontend; `video-rtc.js` is go2rtc's vendored player
- **`entrypoint.sh`** — generates the `camera` stream config from the env vars at startup (kept in a file so go2rtc expands *and* masks the credentialed URL), then runs go2rtc + nginx

Everything lives in one image; `go2rtc.yaml` holds only static base settings.

```sh
docker build -t camview .          # build locally
docker compose up -d --build       # or via compose (uncomment `build:` first)
```

CI (`.github/workflows/docker-publish.yml`) builds a multi-arch image (amd64 + arm64) and pushes the image to GHCR