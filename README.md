# camview

A lightweight, low-latency live viewer for one RTSP security camera. Open it in a browser on your laptop or phone, or leave it running on an Android tablet.

The server is [go2rtc](https://github.com/AlexxIT/go2rtc) and nothing else. It passes the camera's video to each viewer over WebRTC without re-encoding it, and it serves the viewer page itself.

```
camera ──RTSP──▶ Frigate restream ──▶ camview (go2rtc) ──WebRTC──▶ browsers
```

- **Browsers** get the camera's full-resolution Main stream untouched, including H.265 where the browser supports it (Chrome 136+, Safari 18+). A browser that can't play H.265 gets the Sub stream instead; go2rtc chooses per viewer.
- **Audio** from the camera is AAC, which WebRTC can't carry, so ffmpeg converts only the audio to Opus. It runs only while someone is watching.
- **Locked down**: the viewer page and the WebRTC endpoint are the only paths the server answers. go2rtc's own UI, config editor, and stream list are never registered. There is no login, so keep it on your LAN and reach it from outside over a VPN such as Tailscale.

## Deploy

[`compose.yaml`](compose.yaml) is the deployment. Set four variables:

| Variable | Example | What it is |
| --- | --- | --- |
| `MAIN_STREAM_URL` | `rtsp://10.0.0.20:8554/front_door` | The camera's full-resolution stream |
| `SUB_STREAM_URL` | `rtsp://10.0.0.20:8554/front_door_sub` | Its low-resolution stream, for viewers that can't play the main one |
| `LAN_ADDRESS` | `10.0.0.20` | The server's LAN address, advertised to viewers for WebRTC |
| `TAILSCALE_ADDRESS` | `100.88.0.15` | The server's Tailscale address, so WebRTC also works away from home |

Point the stream URLs at a restream (Frigate or go2rtc) if something else already reads the camera. Many cameras allow very few full-resolution sessions, and each extra one can slow the rest. A URL with credentials works too (`rtsp://user:pass@host/...`).

Then `docker compose up -d` and open `http://<server>:3147`.

## Develop

```sh
cd web
pnpm install
CAMVIEW_RELAY=http://10.0.0.20:3147 pnpm dev   # viewer against a running server
pnpm build                                      # type-check and build
docker build -t camview .                       # the whole image, from the repo root
```

The viewer is plain TypeScript built with Vite, with no framework. The server config is [`relay/go2rtc.yaml`](relay/go2rtc.yaml).

Every push to `main` publishes `ghcr.io/chriscorbell/camview:latest` and `:sha-<commit>`.

Background: the vocabulary is in [`CONTEXT.md`](CONTEXT.md), decisions are in [`docs/adr/`](docs/adr/), and what's been learned about the camera and hardware is in [`docs/memory/`](docs/memory/README.md).
