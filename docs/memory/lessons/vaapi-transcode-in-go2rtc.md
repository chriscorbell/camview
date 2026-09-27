# VAAPI transcoding inside go2rtc

Read when: changing the `desk` stream, the `ffmpeg:` templates in `relay/go2rtc.yaml`, the GPU passthrough, or when the Desk display gets audio but no video.
Status: verified
Scope: Relay image (Alpine 3.23, ffmpeg 8.0.1, go2rtc 1.9.14) on minicore's Radeon 780M
Verified: 2026-09-27
Source: test container on minicore on 2026-09-27; go2rtc source (`internal/ffmpeg/ffmpeg.go`, `hardware/hardware.go`)
Recheck when: go2rtc, ffmpeg, Alpine, or the GPU changes.

- **Symptom:** `/api/stream.mp4?src=desk` returns audio only. go2rtc logs nothing, because it starts ffmpeg with `-v error` and silently skips a source that fails. Run the ffmpeg command by hand inside the container to see the error.
- **`hwupload` needs a named device.** With `-hwaccel vaapi` alone, ffmpeg 8 fails with "A hardware device reference is required to upload frames to." Declare it with `-init_hw_device vaapi=gpu:/dev/dri/renderD128 -filter_hw_device gpu -hwaccel_device gpu`.
- **Don't combine `#raw=-vf …` with `#width`, `#height`, or `#hardware`.** go2rtc writes its own `-vf` last, and ffmpeg keeps the last one, so yours is silently dropped. Put the whole filter chain and encoder settings in a custom `#video=` template, and the hwaccel flags in a custom `#input=` template.
- **Re-time with `setpts=N/(25*TB)` plus `-r 25`.** Without it, ffmpeg's constant-frame-rate logic repeats the keyframe about 6 times after each Keyframe stall and then drops the burst behind it.
- **Measured:** 4K HEVC to 1080p H.264 runs at a steady 25 fps and adds about 1–20 ms beyond the source. `-async_depth 1` and `-bf 0` keep the encoder from holding frames.
- **Image size:** the AMD driver (`mesa-va-gallium`) pulls in LLVM, which takes the image from about 226 MB to about 528 MB. There's no lighter radeonsi VAAPI build on Alpine.
