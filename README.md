# camview

A dead-simple, single-container live viewer for an RTSP IP camera. Open it in a
browser and it auto-connects to your camera and shows the feed with **sub-second
latency** over WebRTC.

```
browser ──HTTP/WS──▶ nginx :8080 ──▶ go2rtc :1984 (signaling)
   ▲                                      │
   └──────────── WebRTC media :8555 ◀─────┘  ◀── RTSP from your camera
```

- **go2rtc** does the heavy lifting: it pulls the camera's RTSP stream and
  remuxes the H.264 video into WebRTC (no re-encoding when the codec is already
  browser-compatible, which keeps latency low and CPU usage tiny).
- **nginx** serves the camview web UI and proxies the signaling WebSocket, so
  everything is reachable on one port.
- The web UI auto-connects, auto-reconnects, shows a live/offline indicator, and
  supports double-click fullscreen.

## Quick start (Docker Compose + GHCR image)

You only need **two files** on your server: `docker-compose.yml` and `.env`.
The compose file already points at the pre-built multi-arch image on GHCR
(`ghcr.io/chriscorbell/camview`, rebuilt on every push to `main`), so there's
nothing to build and **no `go2rtc.yaml` to manage** — all configuration is env vars.

1. Grab `docker-compose.yml` and `.env.example` from this repo.
2. Find your camera's RTSP URL (see [examples](#finding-your-rtsp-url)) and set it:

   ```sh
   cp .env.example .env
   # edit .env and set CAMERA_RTSP_URL
   ```

3. Start it:

   ```sh
   docker compose up -d
   ```

4. Open **http://<your-server-ip>:8080** in a browser.

> The GHCR package may be private; if `docker compose up` can't pull, either make
> the package public or run `docker login ghcr.io` first.

## Quick start (plain Docker)

```sh
docker run -d --name camview --restart unless-stopped \
  -p 8080:8080 -p 8555:8555/tcp -p 8555:8555/udp \
  -e CAMERA_RTSP_URL="rtsp://user:pass@192.168.1.50:554/stream1" \
  ghcr.io/chriscorbell/camview:latest
```

Then open http://<your-server-ip>:8080

(`WEBRTC_CANDIDATE` is optional — see [Networking](#networking) below.)

## Build from source instead

Prefer to build locally? Comment out `image:` in `docker-compose.yml`, uncomment
`build: .`, then `docker compose up -d --build` — or `docker build -t camview .`.

## Configuration

All configuration is via environment variables (put them in `.env`):

| Variable            | Required | Default | Description                                                              |
| ------------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `CAMERA_RTSP_URL`   | yes      | —       | Full RTSP URL of your camera, including credentials.                     |
| `WEBRTC_CANDIDATE`  | no       | —       | `"<server-lan-ip>:8555"` to enable true WebRTC. Unset → MSE fallback.    |
| `TRANSCODE`         | no       | `h264`  | `h264` transcodes so any browser plays it; `off` passes the feed as-is.  |
| `HWACCEL`           | no       | —       | Offload the transcode to a GPU: `vaapi`, `cuda`, `qsv`, … (see below).   |

### Finding your RTSP URL

Most cameras follow a fixed pattern. Replace `user`, `pass`, and the IP:

| Brand     | RTSP URL                                                                        |
| --------- | ------------------------------------------------------------------------------- |
| Reolink   | `rtsp://user:pass@IP:554/h264Preview_01_main` (or `_sub` for the low-res feed)  |
| Hikvision | `rtsp://user:pass@IP:554/Streaming/Channels/101`                                |
| Dahua     | `rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=0`                   |
| Amcrest   | `rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=0`                   |
| Generic   | `rtsp://user:pass@IP:554/stream1`                                               |

Not sure? Test the URL first with VLC (*File → Open Network Stream*) or:

```sh
ffprobe "rtsp://user:pass@IP:554/stream1"
```

Tip: use the camera's **sub/low-res stream** for the smoothest experience on
phones and remote connections.

## Networking

camview runs in **bridge networking** (Docker's default) with these ports:

- **8080** — web UI + signaling WebSocket (TCP). The only port strictly required.
- **8555** — WebRTC media (TCP + UDP). Only used when WebRTC is enabled.

There are two transport modes, and the player picks the best one automatically:

| Mode             | When                                   | Latency | Needs                         |
| ---------------- | -------------------------------------- | ------- | ----------------------------- |
| **WebRTC**       | `WEBRTC_CANDIDATE` is set              | <1s     | 8080 **and** 8555 reachable   |
| **MSE** (fallback) | `WEBRTC_CANDIDATE` unset / WebRTC fails | ~1s     | 8080 only                     |

**Why the candidate is needed for WebRTC.** In a bridge network the container
only sees its internal `172.x` address, which your browser can't reach. go2rtc
has no way to guess your server's real LAN IP, so you tell it via
`WEBRTC_CANDIDATE`. Find your server's LAN IP with:

```sh
ip route get 1 | awk '{print $7; exit}'      # Linux
# then set WEBRTC_CANDIDATE=<that-ip>:8555
```

If you skip it, everything still works over port 8080 via MSE — just ~1s of
latency instead of sub-second. For most home-camera use that's indistinguishable.

> Prefer the old zero-config behaviour? You can still run with `--network host`
> (or `network_mode: host` in compose) and leave `WEBRTC_CANDIDATE` unset — go2rtc
> will auto-discover the LAN IP. Bridge mode is now the default for better
> isolation and portability.

## Troubleshooting

- **"Cannot reach the camera stream" overlay** — the camera URL is likely wrong
  or the camera is unreachable. Check the logs:

  ```sh
  docker compose logs -f      # or: docker logs -f camview
  ```

  go2rtc prints the exact RTSP/ffmpeg error there.

- **High CPU usage** — by default camview transcodes to H.264 with ffmpeg so any
  browser can play the feed (your camera may stream H.265/HEVC, which only Safari
  supports). Transcoding only runs while someone is watching. To reduce it: set
  `HWACCEL` to offload to a GPU (see [Hardware transcoding](#hardware-transcoding)),
  or point `CAMERA_RTSP_URL` at the camera's H.264 sub-stream and set
  `TRANSCODE=off`.

- **Video connects then freezes / black screen on a non-Safari browser** —
  usually means the H.264 transcode isn't being produced. Check the container
  logs for ffmpeg errors.

- **Black screen, no errors** — a WebRTC reachability problem. Either unset
  `WEBRTC_CANDIDATE` to fall back to MSE over :8080, or make sure the candidate
  IP is your server's real LAN IP and ports 8555/tcp + 8555/udp are mapped.

- **go2rtc's own diagnostics** — the full go2rtc dashboard is proxied at
  `http://<server-ip>:8080/api/` endpoints; visiting `/api/streams` shows stream
  status as JSON.

## Hardware transcoding

Transcoding HEVC→H.264 in software uses CPU. To offload it to a GPU, set
`HWACCEL` **and** give the container access to the GPU in `docker-compose.yml`
(both halves are required). No files inside the image need editing.

**Intel / AMD (VAAPI / QuickSync)** — works with the bundled ffmpeg:

```yaml
# .env
HWACCEL=vaapi
```
```yaml
# docker-compose.yml (under the camview service) — uncomment:
devices:
  - /dev/dri:/dev/dri
group_add: ["video", "render"]   # must match the GID owning /dev/dri/renderD128
```

**NVIDIA (NVENC / CUDA)** — set `HWACCEL=cuda`, install the NVIDIA Container
Toolkit on the host, and uncomment the `deploy:` GPU block plus add
`NVIDIA_VISIBLE_DEVICES=all` / `NVIDIA_DRIVER_CAPABILITIES=all`. See the comments
in `docker-compose.yml`. (NVENC may require a go2rtc image variant with
NVIDIA-enabled ffmpeg; check the logs for ffmpeg errors if `cuda` fails.)

## Security note

camview has no authentication and is meant for a trusted LAN. Do **not** expose
port 8080/8555 directly to the internet. To access it remotely, put it behind a
VPN (e.g. Tailscale/WireGuard) or an authenticating reverse proxy.

## Files

Files baked into the image (you don't need these on the server):

| File                 | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `Dockerfile`         | Builds the single image (go2rtc + nginx + UI).                |
| `go2rtc.yaml`        | Static base config only; the stream is generated from env vars. |
| `entrypoint.sh`      | Generates the stream config from env vars, supervises both procs. |
| `nginx.conf`         | Serves the UI, proxies signaling WebSocket.                   |
| `web/index.html`     | The camview frontend.                                         |
| `web/video-rtc.js`   | Vendored go2rtc WebRTC player (auto-reconnect).               |

Files you actually deploy with:

| File                 | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `docker-compose.yml` | References the GHCR image; sets ports + env.        |
| `.env`               | Your camera URL and options (from `.env.example`).  |
