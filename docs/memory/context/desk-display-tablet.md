# Desk display tablet: hardware and decode limits

Read when: choosing what resolution or codec the Desk display receives, writing or debugging its native player, installing builds on it, or when video on the tablet goes black or its media daemon crashes.
Status: verified
Scope: environment (the Desk display)
Verified: 2026-09-27
Source: adb inspection plus a throwaway MediaCodec benchmark app run on the tablet on 2026-09-27. Evidence lived in `/tmp/decodebench` on agent-pc (temporary; may be gone). Re-run a decode test to reproduce.
Recheck when: the tablet is replaced, or gets a major Android or vendor firmware update.

## Device

Lenovo Tab M11 (TB330FU), MediaTek MT8786 (`mt6768`, Helio G88 class), Android 15 (SDK 35), 1920x1200 IPS LCD at 90 Hz, 4 GB RAM. LAN `10.0.0.173`, not on the tailnet. Its Android System WebView and Chrome were 127, too old for H.265 over WebRTC.

## Decode limits

- **4K HEVC does not work in hardware.** `c2.mtk.hevc.decoder` accepts `configure()`/`start()` at 3840x2160, then the vendor video daemon (`v3avpud`) logs "Resolution over HW SPEC", dies with SIGBUS, and the app gets a fatal `CodecException`. `MediaCodecInfo...isSizeSupported(3840, 2160)` returns false, and the declared cap in `/vendor/etc/media_codecs_c2.xml` is 2560x1440. The "3840x2160 15–33 fps" line in `media_codecs_performance.xml` is misleading. Always check `isSizeSupported()` before configuring.
- The software HEVC decoder manages 4K at about 25 fps unthrottled, but 98% of frames arrive late in real time, it uses about 60% CPU, and it heats the SoC fast. Unusable.
- **1080p HEVC and 1080p H.264** decode in hardware at 25 fps with no late frames. Latency is about 12 ms p50 per frame on a fresh launch (8–9 ms when warm), I-frames reach 23–45 ms, and total CPU is about 8%.
- **1440p HEVC** also works in hardware: about 17 ms mean latency and about 16% CPU.
- `KEY_LOW_LATENCY` is not supported and makes no measurable difference. MediaTek's `vdec-lowlatency` key saved about 1 ms on HEVC. The decoder never holds frames back.
- The rendered-frame callback reports the frame's own timestamp, not the real display time, so time to screen can't be measured with it.

## The installed app

The release app `com.chriscorbell.camview` is installed from `desk-3` (2026-09-27). It is the default home activity (`cmd package set-home-activity com.chriscorbell.camview/com.chriscorbell.camview.MainActivity`), has `REQUEST_INSTALL_PACKAGES` granted with appops, and is its own installer of record, which is what allows silent self-updates. `adb install -i <pkg>` only takes effect once the package already exists, so install once and then reinstall with `-r -i com.chriscorbell.camview`. The Reolink app is also on the tablet; see the lesson on decoder contention.

## Access

Wireless debugging is paired with agent-pc (2026-09-27). The connect port changes; find it with `sudo nmap -Pn -p 30000-49999 --min-rate 3000 10.0.0.173`, then run `adb connect 10.0.0.173:<port>`. Android turns wireless debugging off after reboots and Wi-Fi changes. The Android SDK is at `~/Android/Sdk` on agent-pc.
