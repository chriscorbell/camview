# Deployment

Read when: deploying, updating, or checking the running camview, changing its ports, network, or environment, deciding who can reach it, or planning hardware transcoding.
Status: verified
Scope: environment (the production server)
Verified: 2026-09-27
Source: inspection of the server and the cutover on 2026-09-27; the GPU driver and the Relay URL secret on 2026-10-27. Raw output was not kept; this note summarizes it. This repo is public, so addresses, host names and file paths are kept in Chris's private infrastructure notes, not here.
Recheck when: the rebuild or any later change alters the image, compose file, env file, ports, network, exposure, or the host's GPU or drivers.

## Container

- Runs as container `camview` from `ghcr.io/chriscorbell/camview:latest` (the go2rtc-only Relay since 2026-09-27, PR #3). Watchtower on the server polls GHCR every 60 s and recreates it when `:latest` moves, reusing the running container's config, not the compose file. Change env on the running container (compose `up -d`) before merging anything that needs new env.
- The running compose file is the repo's `compose.yaml` with the real addresses in place of its examples. The config is inline env with no secrets: Frigate's restream needs no credentials.
- The pre-rebuild leftovers, a compose backup and an env file that held the old `CAMERA_RTSP_URL` with Camera credentials, were deleted on 2026-09-27 at Chris's request. camview keeps no Camera credentials anywhere.
- `/dev/dri` is passed through with `group_add: "991"` (render), for the `desk` stream's VAAPI conversion. It was added to the running container before the Desk display PR (#4) merged.
- Bridge network. Published ports: 3147→8080 (viewer and signaling) and 8555 TCP and UDP (WebRTC). WebRTC candidates are the server's LAN and Tailscale addresses on 8555, both verified end to end on 2026-09-27; the Tailscale path was forced by stripping the LAN candidate. Chris confirmed the same day that Safari on iPhone and Helium on the Mac both play it well over Tailscale.
- The Desk display app's Relay URL is the repository secret `CAMVIEW_RELAY_URL`, built into every release since 2026-10-27. If the server's address changes, update the secret and publish a release, or the Desk display loses the Feed.
- CI publishes a new image only when `relay/`, `web/`, the Dockerfile, `.dockerignore`, or `ci.yml` change, because every publish makes Watchtower restart the Relay.

## Exposure

Reachable only on the LAN and over Tailscale. It isn't behind any public tunnel or proxy, and it has no authentication, so keep it off any public route.

## GPU

Since 2026-10-28 the server is an Intel Core i5-13500 with UHD 770 graphics at `/dev/dri/renderD128`, render group gid 991, and VAAPI goes through Intel's iHD driver. Before that it was a Radeon 780M with Mesa radeonsi. A container that transcodes on the GPU needs that device passed through, plus gid 991 as a supplementary group when it runs as a non-root user. The Intel GPU hangs on spliced HEVC; [the VAAPI lesson](../lessons/vaapi-transcode-in-go2rtc.md) explains why the `desk` source asks for audio.
