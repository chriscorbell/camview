# camview

A lightweight, low-latency live viewer for one home security camera, watched from a browser or an always-on desk tablet.

## Language

**Camera**:
The single IP camera camview exists to show. There is exactly one.
_Avoid_: Cam, device, source

**Feed**:
The live picture and sound from the **Camera**, as a viewer sees it. Live only: there is no recording, playback, or snapshot.
_Avoid_: Stream, video, live view

**Main stream**:
The **Camera**'s full-resolution encoding.
_Avoid_: HD stream, clear

**Sub stream**:
The **Camera**'s low-resolution encoding, offered alongside the **Main stream**. A **Viewer** that can't play the **Main stream** gets this instead.
_Avoid_: SD stream, fluent, low-res stream

**Keyframe stall**:
The short pause each time the **Camera** sends a keyframe: it trickles out the large frame and holds back the frames behind it.
_Avoid_: Freeze, hiccup, lag

**Relay**:
The camview server: it holds the only connection to the **Camera** and hands the **Feed** to every **Viewer**.
_Avoid_: Server, backend, proxy

**Viewer**:
Anything showing the **Feed**: a browser tab, or the **Desk display**.
_Avoid_: Client, player

**Desk display**:
The always-on Android tablet on Chris's desk that shows the **Feed** around the clock.
_Avoid_: Tablet, kiosk, tablet app
