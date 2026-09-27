# Camera and its streams

Read when: choosing which Camera stream camview pulls, deciding whether to transcode, planning how many connections camview may open, or debugging codec, resolution, latency, or connection-limit problems.
Status: verified
Scope: environment (the Camera, and Frigate on minicore)
Verified: 2026-09-27
Source: read-only inspection of the Camera and minicore on 2026-09-27. Raw output was not kept; this note summarizes it. The checks below reproduce the stream and port facts and locate Frigate's configuration.
Recheck when: the Camera's settings or firmware change, or Frigate's configuration changes.

## Camera

Reolink RLC-820A at `10.0.0.200`, firmware v3.1.0.5223_2508072063. Only ports 554 (RTSP), 8000 (ONVIF), and 9000 are open. The HTTP web UI and API are disabled, so nothing can be read or configured over HTTP.

## Streams

| | Main stream | Sub stream |
| --- | --- | --- |
| RTSP path | `h264Preview_01_main` | `h264Preview_01_sub` |
| Video | HEVC Main L5.0, 3840x2160, 25 fps, ~7 Mbps | H.264 High, 640x360, ~10 fps, ~220 kbps |
| Keyframe interval | ~2 s | ~4 s |
| Audio | AAC-LC 16 kHz mono | AAC-LC 16 kHz mono |

The Main stream path says `h264` but carries HEVC; judge the codec from a probe, never from the path. There is no `_ext` stream.

## Session limit and Frigate

The Camera allows 12 simultaneous stream sessions: 10 Sub stream and 2 Main stream. Frigate 0.18 on minicore permanently holds one Main stream and one Sub stream session, so at most one more Main stream session and nine more Sub stream sessions are available to camview directly.

Frigate restreams both on `minicore:8554` as `front_door` (Main stream) and `front_door_sub` (Sub stream). Both are plain passthroughs with audio intact, and the restream has no authentication. Frigate's own recorder reads the restream, so Frigate holds exactly those two Camera sessions. Reading the restream instead of the Camera added no measurable latency (go2rtc on both sides: median −2 ms, mean +1 ms; 2026-09-27). The trade-off is that the restream drops whenever Frigate restarts; it tracks `:stable` under Watchtower. It records motion clips for 14 days to `/nas/media/reolink`.

## Keyframe stall and timestamps

Measured 2026-09-27, in daylight with a mostly static scene. Scripts and raw JSON were in `/tmp/rtspprobe/` on agent-pc (temporary).

- Main stream keyframes are about 1 MB, which is 64–68% of all video bytes. P-frames are about 12 KB, and VBR sits at its 6144 kbps cap.
- The Camera's RTSP sender pushes about 28 Mbps in total, shared by every session. With one session (Frigate's), a keyframe takes 0.22–0.37 s to arrive. The frames behind it queue and then burst. The worst lateness per GOP is about 0.28 s typical and 0.36 s max.
- **Every extra Main stream session slows all of them down**, Frigate's included. With two sessions, each keyframe takes 0.55–1.03 s, and the Camera has been seen replacing 13 frames with near-empty ones. Read the Frigate restream instead of opening a second session. The restream re-sends the same stall and adds nothing.
- **Timestamps are send times, not capture times.** Main stream RTP timestamps match first-byte arrival, so a player that trusts them freezes and then fast-forwards at every keyframe, whatever its buffer. The Camera does capture at a steady 25 fps (every GOP has exactly 50 frames), so re-timing to a fixed 40 ms cadence is valid. That holds only while the frame rate stays fixed; `constantFrameRate` is currently 0, which lets it drop in low light.
- The Sub stream stalls about the same, roughly 0.3 s, because its keyframes share the sender with the Main stream's.
- UDP is only somewhat faster than TCP. The limit is the Camera's sender, not TCP and not the encoder.

## Encoder settings (read-only, via ONVIF and Baichuan)

- Main stream: H.265 at 3840x2160 (also offers 2560x1440 and 2304x1296), 25 fps (range 2–25), 6144 kbps (4096–8192 at 4K), I-frame interval 2x fps (1x or 2x allowed). VBR only; there's no CBR on this model.
- Sub stream: H.264 at 640x360 only, 10 fps (4/7/10/15), 256 kbps (64–512), I-frame interval 4x (1x–4x).
- A third 896x512 stream exists, but not over RTSP (`_ext` returns 404).
- Frigate's Reolink guidance recommends an I-frame interval of 1x and "fluency first" (fixed frame rate): https://docs.frigate.video/configuration/camera_specific/#reolink-cameras
- **Caution:** `reolink_aio` can silently re-enable the Camera's HTTP, HTTPS, and RTMP ports when HTTP login fails. Use only raw Baichuan reads, or change settings in the Reolink app.

## Checks

Never write credentials into memory; use `<user>:<pass>` placeholders in anything you save.

- Codec, resolution, frame rate, audio: `ffprobe -v error -rtsp_transport tcp -show_streams "rtsp://<user>:<pass>@10.0.0.200:554/h264Preview_01_main"`, and the same for `h264Preview_01_sub`.
- Open ports: `nmap -Pn -p- 10.0.0.200`.
- Frigate: its compose file is `/home/chris/docker/stacks/frigate/compose.yaml` and its config is `/home/chris/docker/data/frigate/config/config.yml` on minicore.
