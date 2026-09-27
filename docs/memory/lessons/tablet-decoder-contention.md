# Desk display: decoder contention, hidden logs, and launcher quirks

Read when: the Desk display app crashes or stalls when starting video, MediaCodec reports NO_MEMORY, `Log.d` output is missing on the tablet, Home opens a picker or the stock launcher, or a "•••" handle appears over the Feed.
Status: verified
Scope: Desk display (Lenovo Tab M11, Android 15)
Verified: 2026-09-27
Source: tablet logcat on 2026-09-27 (crash buffer and ResourceManager lines)

- **The Reolink app (`com.mcu.reolink`) is installed on the tablet.** While it plays video it holds the MediaTek decoder, and when it asks for the 4K Main stream the vendor `v3avpud` daemon crashes (SIGBUS in `libHEVCdec`). Our `MediaCodec.start()` then fails with `NO_MEMORY`, and Android reclaims a codec from the other app. The player catches decoder start and queue failures, drops the connection, and retries; it must never let a `CodecException` escape a handler thread.
- **Check before driving the tablet over adb:** `dumpsys activity activities | grep topResumedActivity`. Chris may be using the tablet, for example in the Reolink app. Don't launch test builds over him.
- **Lenovo suppresses `Log.d` from apps.** Use `Log.i` for diagnostics you need to read with `adb logcat`.
- **The stock ZUI launcher (`com.zui.launcher`) always runs**, because it also draws Recents. When our process dies (self-update, crash), Android resumes it instead of starting the home app. That's why `StayInFront` relaunches the Feed on `MY_PACKAGE_REPLACED` and after crashes (verified: desk-5 → desk-7 update came back on its own). Don't `am force-stop com.zui.launcher`: right after doing that, Home opened the ZUI resolver ("choose home app") until `cmd package set-home-activity` was run again.
- **The "•••" bar over the top of the Feed** is Lenovo's freeform bar, not the app. `android:resizeableActivity="false"` doesn't remove it; `settings put system enable_temp_zuifreeformbar 0` does (set 2026-09-27).
