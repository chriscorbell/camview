# Desk display: other apps take the decoder, and debug logs are hidden

Read when: the Desk display app crashes or stalls when starting video, MediaCodec reports NO_MEMORY, or `Log.d` output is missing on the tablet.
Status: verified
Scope: Desk display (Lenovo Tab M11, Android 15)
Verified: 2026-09-27
Source: tablet logcat on 2026-09-27 (crash buffer and ResourceManager lines)

- **The Reolink app (`com.mcu.reolink`) is installed on the tablet.** While it plays video it holds the MediaTek decoder, and when it asks for the 4K Main stream the vendor `v3avpud` daemon crashes (SIGBUS in `libHEVCdec`). Our `MediaCodec.start()` then fails with `NO_MEMORY`, and Android reclaims a codec from the other app. The player catches decoder start and queue failures, drops the connection, and retries; it must never let a `CodecException` escape a handler thread.
- **Check before driving the tablet over adb:** `dumpsys activity activities | grep topResumedActivity`. Chris may be using the tablet, for example in the Reolink app. Don't launch test builds over him.
- **Lenovo suppresses `Log.d` from apps.** Use `Log.i` for diagnostics you need to read with `adb logcat`.
