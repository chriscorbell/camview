#!/bin/sh
# Start go2rtc (RTSP -> WebRTC engine) and nginx (frontend + signaling proxy)
# together in one container. If either process dies, the container exits so
# Docker's restart policy can recover it.
set -e

if [ -z "$CAMERA_RTSP_URL" ]; then
    echo "FATAL: CAMERA_RTSP_URL is not set." >&2
    echo "Pass it with -e CAMERA_RTSP_URL='rtsp://user:pass@host:554/stream'" >&2
    exit 1
fi

mkdir -p /tmp/nginx-client /tmp/nginx-proxy /tmp/nginx-fastcgi /tmp/nginx-uwsgi /tmp/nginx-scgi

# Forward termination signals to children for clean shutdown.
trap 'kill -TERM "$go2rtc_pid" "$nginx_pid" 2>/dev/null; exit 0' TERM INT

# In bridge mode go2rtc can't auto-detect a browser-reachable address. If the
# operator supplied one, inject it as an additional inline config (go2rtc merges
# multiple -config args). Otherwise the player falls back to MSE over :8080.
if [ -n "$WEBRTC_CANDIDATE" ]; then
    echo "[camview] advertising WebRTC candidate: $WEBRTC_CANDIDATE"
    candidate_cfg="{\"webrtc\":{\"candidates\":[\"$WEBRTC_CANDIDATE\"]}}"
else
    echo "[camview] WEBRTC_CANDIDATE not set — WebRTC will fall back to MSE over :8080 (still low latency)."
    candidate_cfg=""
fi

echo "[camview] starting go2rtc…"
go2rtc -config /config/go2rtc.yaml ${candidate_cfg:+-config "$candidate_cfg"} &
go2rtc_pid=$!

echo "[camview] starting nginx on :8080…"
nginx -g 'daemon off;' &
nginx_pid=$!

# Portable supervision: exit if either child stops running.
while kill -0 "$go2rtc_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
    sleep 2
done

echo "[camview] a process exited; shutting down." >&2
kill -TERM "$go2rtc_pid" "$nginx_pid" 2>/dev/null || true
exit 1
