# VAAPI transcoding inside go2rtc

Read when: changing the `desk` stream, the `ffmpeg:` templates in `relay/go2rtc.yaml`, the GPU passthrough, or when the Desk display gets audio but no video.
Status: verified
Scope: Relay image (Alpine 3.23, ffmpeg 8.0.1, go2rtc 1.9.14) on a Radeon 780M (Mesa radeonsi 25.2.7) and an Intel UHD 770 (iHD 25.4.6)
Verified: 2026-10-27
Source: test container on the Radeon on 2026-09-27; test containers on both GPUs on 2026-10-27, running the `desk` templates on a synthetic 4K HEVC clip; go2rtc source (`internal/ffmpeg/ffmpeg.go`, `hardware/hardware.go`)
Recheck when: go2rtc, ffmpeg, Alpine, or the GPU changes.

- **Symptom:** `/api/stream.mp4?src=desk` returns audio only. go2rtc logs nothing, because it starts ffmpeg with `-v error` and silently skips a source that fails. Run the ffmpeg command by hand inside the container to see the error.
- **`hwupload` needs a named device.** With `-hwaccel vaapi` alone, ffmpeg 8 fails with "A hardware device reference is required to upload frames to." Declare it with `-init_hw_device vaapi=gpu:/dev/dri/renderD128 -filter_hw_device gpu -hwaccel_device gpu`.
- **Don't combine `#raw=-vf …` with `#width`, `#height`, or `#hardware`.** go2rtc writes its own `-vf` last, and ffmpeg keeps the last one, so yours is silently dropped. Put the whole filter chain and encoder settings in a custom `#video=` template, and the hwaccel flags in a custom `#input=` template.
- **Re-time with `setpts=N/(25*TB)` plus `-r 25`.** Without it, ffmpeg's constant-frame-rate logic repeats the keyframe about 6 times after each Keyframe stall and then drops the burst behind it.
- **Measured:** 4K HEVC to 1080p H.264 runs at a steady 25 fps and adds about 1–20 ms beyond the source. `-async_depth 1` and `-bf 0` keep the encoder from holding frames.
- **One image serves both GPUs.** libva loads radeonsi on an AMD GPU and iHD on an Intel one, and both encode through `VAEntrypointEncSlice`, so the templates need no change between them. Each converts 200 frames of 4K HEVC to 1080p H.264 in about a second.
- **Image size:** the AMD driver (`mesa-va-gallium`) pulls in LLVM, which takes the image from about 226 MB to about 528 MB, and the Intel driver (`intel-media-driver`) adds about 54 MB more, to 582 MB. There's no lighter radeonsi VAAPI build on Alpine, so dropping the AMD driver is the way to shrink the image once no host needs it.
