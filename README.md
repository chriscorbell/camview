# camview

Single-container live viewer for an RTSP IP camera. Open it in a browser and it
auto-connects and shows the feed with sub-second latency over WebRTC (with an
automatic MSE fallback). Non-H.264 cameras are transcoded on the fly so any
browser can play them.

## Run it

Needs only a `CAMERA_RTSP_URL`. The image is on GHCR — nothing to build.

**docker run:**

```sh
docker run -d --name camview --restart unless-stopped \
  -p 8080:8080 -p 8555:8555/tcp -p 8555:8555/udp \
  -e CAMERA_RTSP_URL="rtsp://user:pass@192.168.1.50:554/stream1" \
  ghcr.io/chriscorbell/camview:latest
```

**docker compose** — copy `docker-compose.yml` + `.env.example` to your server:

```sh
cp .env.example .env   # set CAMERA_RTSP_URL
docker compose up -d
```

Then open **http://<server-ip>:8080**.

### Configuration (env vars)

| Variable           | Default | Description                                                            |
| ------------------ | ------- | ---------------------------------------------------------------------- |
| `CAMERA_RTSP_URL`  | —       | **Required.** Full RTSP URL incl. credentials.                        |
| `WEBRTC_CANDIDATE` | —       | `"<server-lan-ip>:8555"` for true WebRTC; unset falls back to MSE.    |
| `TRANSCODE`        | `h264`  | `off` to pass the feed through (use with a native H.264 sub-stream).   |
| `HWACCEL`          | —       | GPU offload for the transcode: `vaapi`, `cuda`, `qsv`, …               |

Notes:
- **WebRTC vs MSE:** with bridge networking the container can't auto-detect a
  browser-reachable IP, so WebRTC (sub-second) needs `WEBRTC_CANDIDATE`. Without
  it, the player uses MSE over port 8080 (~1s) — fine for most camera viewing.
- **Hardware transcode:** set `HWACCEL` *and* pass the GPU through in
  `docker-compose.yml` (see the commented blocks there).
- Find your RTSP URL in the camera's app/manual; test it with `ffprobe "<url>"`.
- LAN-only, no auth. Don't expose to the internet — use a VPN for remote access.

## Tech stack & development

```
browser ──HTTP/WS :8080──▶ nginx ──▶ go2rtc :1984 (signaling)
   ▲                                     │
   └─────────── WebRTC media :8555 ◀─────┘  ◀── RTSP from camera
```

- **[go2rtc](https://github.com/AlexxIT/go2rtc)** — pulls the RTSP stream and
  serves it as WebRTC/MSE; runs the on-demand ffmpeg H.264 transcode.
- **nginx** — serves the static UI and reverse-proxies the signaling WebSocket,
  so everything is on one port.
- **`web/`** — the frontend; `video-rtc.js` is go2rtc's vendored player.
- **`entrypoint.sh`** — generates the `camera` stream config from the env vars at
  startup (kept in a file so go2rtc expands *and* masks the credentialed URL),
  then runs go2rtc + nginx.

Everything lives in one image; `go2rtc.yaml` holds only static base settings.

```sh
docker build -t camview .          # build locally
docker compose up -d --build       # or via compose (uncomment `build:` first)
```

CI (`.github/workflows/docker-publish.yml`) builds a multi-arch image
(amd64 + arm64) and pushes to GHCR on every push to `main` and on `v*` tags.
