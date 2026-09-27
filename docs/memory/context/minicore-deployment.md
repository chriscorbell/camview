# Deployment on minicore

Read when: deploying, updating, or checking the running camview, changing its ports, network, or environment, deciding who can reach it, or planning hardware transcoding.
Status: verified
Scope: environment (production host `minicore`)
Verified: 2026-09-27
Source: read-only inspection of minicore on 2026-09-27. Raw output was not kept; this note summarizes it. General minicore facts (IPs, hardware, where stacks and data live) belong to the fleet inventory, `chriscorbell/fleet` `AGENTS.md` (locally `~/Code/fleet/AGENTS.md`).
Recheck when: the rebuild or any later change alters the image, compose file, env file, ports, network, exposure, or the host's GPU or drivers.

## Container

- Runs as container `camview` from `ghcr.io/chriscorbell/camview:latest`.
- Compose file: `/home/chris/docker/stacks/camview/compose.yaml`.
- Env file: `/home/chris/docker/data/camview/.env`, holding `CAMERA_RTSP_URL` and `WEBRTC_CANDIDATE`. It contains credentials: read single keys when needed and never copy values into the repo or memory.
- Bridge network. Published ports: 3147 (UI) and 8555 TCP and UDP (WebRTC).

## Exposure

Reachable only on the LAN (`10.0.0.20`) and over Tailscale (`100.88.0.15`, `minicore.tail047de3.ts.net`). It is not in the cloudflared tunnel and has no authentication, so keep it off any public route.

## GPU

Radeon 780M at `/dev/dri/renderD128`, render group gid 991. VAAPI works through Mesa radeonsi, with H.264, HEVC, and AV1 encode and decode. A container that transcodes on the GPU needs that device passed through, plus gid 991 as a supplementary group when it runs as a non-root user.
