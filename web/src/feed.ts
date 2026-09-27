// Keeps one WebRTC connection to a Relay stream playing in a <video>, and
// reconnects whenever frames stop arriving.

export type FeedState = 'connecting' | 'live' | 'reconnecting';

// The Camera's Keyframe stall is ~0.3 s, so a gap this long is a real outage.
const STALL_MS = 2500;
// A new Viewer waits for the next keyframe, which the Camera sends every 1–2 s.
const FIRST_FRAME_MS = 6000;
const RETRY_MS = [500, 1000, 2000, 5000];
// go2rtc doesn't trickle ICE, so the offer carries our candidates. Host
// candidates take a few ms; this only caps a slow gather.
const ICE_GATHER_MS = 500;

export class Feed {
  readonly #video: HTMLVideoElement;
  readonly #src: string;
  readonly #onState: (state: FeedState) => void;
  #pc: RTCPeerConnection | null = null;
  #state: FeedState = 'connecting';
  #attemptAt = 0;
  #lastFrameAt = 0;
  #failures = 0;
  #retryTimer = 0;
  #watchdog = 0;

  constructor(video: HTMLVideoElement, src: string, onState: (state: FeedState) => void) {
    this.#video = video;
    this.#src = src;
    this.#onState = onState;
  }

  start(): void {
    if (this.#watchdog) return;
    this.#watchdog = window.setInterval(() => this.#checkFrames(), 500);
    void this.#connect();
  }

  stop(): void {
    window.clearInterval(this.#watchdog);
    window.clearTimeout(this.#retryTimer);
    this.#watchdog = 0;
    if (this.#state === 'live') this.#setState('reconnecting');
    this.#close();
  }

  async #connect(): Promise<void> {
    const pc = new RTCPeerConnection();
    this.#pc = pc;
    this.#attemptAt = performance.now();
    const stream = new MediaStream();
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.ontrack = ({ track }) => stream.addTrack(track);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.#fail();
    };

    try {
      await pc.setLocalDescription(await pc.createOffer());
      await iceGathered(pc);
      const res = await fetch(`/api/webrtc?src=${encodeURIComponent(this.#src)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp,
      });
      if (!res.ok) throw new Error(`Relay answered ${res.status}`);
      const answer = await res.text();
      if (pc !== this.#pc) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    } catch {
      if (pc === this.#pc) this.#fail();
      return;
    }
    if (pc !== this.#pc) return;

    this.#video.srcObject = stream;
    this.#countFrames(pc);
  }

  #countFrames(pc: RTCPeerConnection): void {
    const video = this.#video;
    const onFrame = () => {
      if (pc !== this.#pc) return false;
      this.#lastFrameAt = performance.now();
      this.#failures = 0;
      this.#setState('live');
      return true;
    };
    if ('requestVideoFrameCallback' in video) {
      const loop = () => {
        if (onFrame()) video.requestVideoFrameCallback(loop);
      };
      video.requestVideoFrameCallback(loop);
    } else {
      const onTime = () => {
        if (!onFrame()) (video as HTMLVideoElement).removeEventListener('timeupdate', onTime);
      };
      (video as HTMLVideoElement).addEventListener('timeupdate', onTime);
    }
  }

  #checkFrames(): void {
    if (!this.#pc) return;
    const now = performance.now();
    const stalled =
      this.#state === 'live'
        ? now - this.#lastFrameAt > STALL_MS
        : now - this.#attemptAt > FIRST_FRAME_MS;
    if (stalled) this.#fail();
  }

  #fail(): void {
    // Announce first: the UI freezes the last frame while it's still on screen.
    if (this.#state === 'live') this.#setState('reconnecting');
    this.#close();
    const delay = RETRY_MS[Math.min(this.#failures++, RETRY_MS.length - 1)];
    window.clearTimeout(this.#retryTimer);
    this.#retryTimer = window.setTimeout(() => void this.#connect(), delay);
  }

  #close(): void {
    const pc = this.#pc;
    this.#pc = null;
    if (!pc) return;
    pc.onconnectionstatechange = null;
    pc.ontrack = null;
    pc.close();
  }

  #setState(state: FeedState): void {
    if (state === this.#state) return;
    this.#state = state;
    this.#onState(state);
  }
}

function iceGathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      window.clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = window.setTimeout(done, ICE_GATHER_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}
