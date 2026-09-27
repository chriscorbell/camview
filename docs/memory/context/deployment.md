# Deployment

Read when: deploying, updating, or checking the running camview, changing its ports, network, or environment, deciding who can reach it, or planning hardware transcoding.
Status: verified
Scope: environment (production host `server`)
Verified: 2026-09-27
Source: read-only inspection of the server on 2026-09-27. Raw output was not kept; this note summarizes it. Host facts are kept in Chris's private infrastructure notes.
Recheck when: the rebuild or any later change alters the image, compose file, env file, ports, network, exposure, or the host's GPU or drivers.

## Container

- Runs as container `camview` from `ghcr.io/chriscorbell/camview:latest`.
- Compose file: `<stacks>/camview/compose.yaml`.
- Env file: `<data>/camview/.env`, holding `CAMERA_RTSP_URL` and `WEBRTC_CANDIDATE`. It contains credentials: read single keys when needed and never copy values into the repo or memory.
- Bridge network. Published ports: 3147 (UI) and 8555 TCP and UDP (WebRTC).

## Exposure

Reachable only on the LAN (`192.168.1.20`) and over Tailscale (`100.64.0.20`, `server.example.ts.net`). It is not in a public tunnel and has no authentication, so keep it off any public route.

## GPU

Radeon 780M at `/dev/dri/renderD128`, render group gid 991. VAAPI works through Mesa radeonsi, with H.264, HEVC, and AV1 encode and decode. A container that transcodes on the GPU needs that device passed through, plus gid 991 as a supplementary group when it runs as a non-root user.
