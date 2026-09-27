# Lessons

Verified failure mechanisms and corrections that change a future attempt. Search here when a symptom resembles a past failure.

One bullet per lesson, with a relative link and the symptom or task that should trigger reading it. A provisional lesson says "provisional" in its cue so a reader knows it is a hypothesis before relying on it. Update the matching lesson when evidence changes; [the note format](../note-format.md) states what a lesson records.

Threshold: 12 entries. Past it, the bounded review in [maintenance](../maintenance.md) samples this category first.

## Notes

- [VAAPI transcoding inside go2rtc](vaapi-transcode-in-go2rtc.md): read when the Desk display gets audio but no video, or when changing the `desk` stream, the ffmpeg templates, or the GPU passthrough.
- [Desk display decoder contention and launcher quirks](tablet-decoder-contention.md): read when the tablet app crashes starting video, MediaCodec reports NO_MEMORY, debug logs are missing, Home opens a picker or the stock launcher, or a "•••" handle covers the Feed.
