# Deployment on minicore

Read when: deploying, updating, or checking the running camview, changing its ports, network, or environment, deciding who can reach it, or planning hardware transcoding.
Status: verified
Scope: environment (production host `minicore`)
Verified: 2026-09-27
Source: inspection of minicore and the cutover on 2026-09-27. Raw output was not kept; this note summarizes it. General minicore facts (IPs, hardware, where stacks and data live) belong to the fleet inventory, `chriscorbell/fleet` `AGENTS.md` (locally `~/Code/fleet/AGENTS.md`).
Recheck when: the rebuild or any later change alters the image, compose file, env file, ports, network, exposure, or the host's GPU or drivers.

## Container

- Runs as container `camview` from `ghcr.io/chriscorbell/camview:latest` (the go2rtc-only Relay since 2026-09-27, PR #3). Watchtower on minicore polls GHCR every 60 s and recreates it when `:latest` moves, reusing the running container's config, not the compose file. Change env on the running container (compose `up -d`) before merging anything that needs new env.
- Compose file: `/home/chris/docker/stacks/camview/compose.yaml`, matching the repo's `compose.yaml`. The config is inline env with no secrets: Frigate's restream needs no credentials. The pre-rebuild compose is kept as `compose.yaml.bak-2026-09-27` next to it.
- `/home/chris/docker/data/camview/.env` is no longer used. It still holds the old `CAMERA_RTSP_URL` with Camera credentials; never copy its values anywhere.
- `/dev/dri` is passed through with `group_add: "991"` (render), for the `desk` stream's VAAPI conversion. It was added to the running container before the Desk display PR (#4) merged.
- Bridge network. Published ports: 3147→8080 (viewer and signaling) and 8555 TCP and UDP (WebRTC). WebRTC candidates are `10.0.0.20:8555` and `100.88.0.15:8555`, both verified end to end on 2026-09-27; the Tailscale path was forced by stripping the LAN candidate.

## Exposure

Reachable only on the LAN (`10.0.0.20`) and over Tailscale (`100.88.0.15`, `minicore.tail047de3.ts.net`). It is not in the cloudflared tunnel and has no authentication, so keep it off any public route.

## GPU

Radeon 780M at `/dev/dri/renderD128`, render group gid 991. VAAPI works through Mesa radeonsi, with H.264, HEVC, and AV1 encode and decode. A container that transcodes on the GPU needs that device passed through, plus gid 991 as a supplementary group when it runs as a non-root user.
