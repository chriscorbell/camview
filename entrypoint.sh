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

# The "camera" stream is generated from env vars at runtime and merged with the
# baked-in static config (go2rtc deep-merges multiple -config files). This is
# what lets the GHCR image run with ONLY compose + .env — no go2rtc.yaml on the
# host. Tunable via:
#   CAMERA_RTSP_URL  (required) the camera source
#   TRANSCODE        h264 (default) | off   — "off" passes the feed through as-is
#   HWACCEL          (optional) vaapi | cuda | qsv | ...  — GPU for the transcode
#   WEBRTC_CANDIDATE (optional) "<lan-ip>:8555" to enable true WebRTC
#
# We write the ${CAMERA_RTSP_URL} / ${WEBRTC_CANDIDATE} placeholders into a FILE
# (not an inline -config string, which go2rtc does NOT env-expand). go2rtc then
# expands them at load time AND masks them as "***" in /api/streams, so the
# camera credentials are never exposed to anyone who can reach :8080/api/.
gen=/tmp/camview-stream.yaml
{
    echo "streams:"
    echo "  camera:"
    echo "    - \${CAMERA_RTSP_URL}"
    case "$(printf '%s' "${TRANSCODE:-h264}" | tr '[:upper:]' '[:lower:]')" in
        off|none|no|false|0)
            echo "[camview] transcoding disabled — passing the camera stream through unchanged." >&2
            ;;
        *)
            if [ -n "$HWACCEL" ]; then
                hw="#hardware=$HWACCEL"
                echo "[camview] H.264 transcode with hardware acceleration: $HWACCEL" >&2
            else
                hw=""
                echo "[camview] H.264 transcode (software). Set HWACCEL=vaapi|cuda|qsv for GPU offload." >&2
            fi
            echo "    - ffmpeg:camera#video=h264${hw}#audio=aac#audio=opus"
            ;;
    esac
    if [ -n "$WEBRTC_CANDIDATE" ]; then
        echo "[camview] advertising WebRTC candidate: $WEBRTC_CANDIDATE" >&2
        echo "webrtc:"
        echo "  candidates:"
        echo "    - \${WEBRTC_CANDIDATE}"
    else
        echo "[camview] WEBRTC_CANDIDATE not set — WebRTC will fall back to MSE over :8080 (still low latency)." >&2
    fi
} > "$gen"

echo "[camview] starting go2rtc…"
go2rtc -config /config/go2rtc.yaml -config "$gen" &
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
