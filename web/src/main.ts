import { createElement, Maximize, Minimize, Volume2, VolumeX, type IconNode } from 'lucide';
import { Feed, type FeedState } from './feed';
import './style.css';

const stage = document.querySelector<HTMLElement>('.stage')!;
const video = stage.querySelector<HTMLVideoElement>('.feed')!;
const status = stage.querySelector<HTMLElement>('.status')!;
const controls = stage.querySelector<HTMLElement>('.controls')!;

// While reconnecting, the last frame stays up, dimmed, so a frozen picture
// never passes for live. The <video> itself goes black once the new
// connection replaces its stream, so the frame is copied out first.
const freeze = document.createElement('canvas');
freeze.className = 'freeze';
freeze.setAttribute('aria-hidden', 'true');
video.after(freeze);

const LABELS: Record<Exclude<FeedState, 'live'>, string> = {
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
};

const feed = new Feed(video, 'feed', (state) => {
  if (state === 'reconnecting') freezeFrame();
  stage.dataset.state = state;
  // Keep the old label while going live so it fades out instead of collapsing.
  if (state !== 'live') status.textContent = LABELS[state];
});

function freezeFrame(): void {
  const { videoWidth: width, videoHeight: height } = video;
  if (!width || !height) return;
  const scale = Math.min(1, 1920 / width);
  freeze.width = Math.round(width * scale);
  freeze.height = Math.round(height * scale);
  freeze.getContext('2d')?.drawImage(video, 0, 0, freeze.width, freeze.height);
}

// Sound. Every device starts muted, because browsers block autoplay with
// sound. The choice is remembered; if the last choice was sound on, the first
// tap anywhere brings it back.
const SOUND_KEY = 'camview.sound';
let wantsSound = localStorage.getItem(SOUND_KEY) === 'on';

const muteButton = button('Unmute', () => setSound(video.muted));

function setSound(on: boolean): void {
  wantsSound = on;
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  video.muted = !on;
  if (on) video.play().catch(() => (video.muted = true));
  renderMute();
}

function renderMute(): void {
  const label = video.muted ? 'Unmute' : 'Mute';
  muteButton.replaceChildren(icon(video.muted ? VolumeX : Volume2));
  muteButton.setAttribute('aria-label', label);
  muteButton.title = `${label} (M)`;
}

stage.addEventListener(
  'pointerdown',
  (event) => {
    if (wantsSound && video.muted && !muteButton.contains(event.target as Node)) setSound(true);
  },
  { once: true },
);

// Fullscreen, where the browser allows it (not on iPhone).
const fullscreenButton = document.fullscreenEnabled
  ? button('Fullscreen', () => toggleFullscreen())
  : null;

function toggleFullscreen(): void {
  if (!document.fullscreenEnabled) return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void stage.requestFullscreen().catch(() => undefined);
}

function renderFullscreen(): void {
  if (!fullscreenButton) return;
  const on = Boolean(document.fullscreenElement);
  const label = on ? 'Exit fullscreen' : 'Fullscreen';
  fullscreenButton.replaceChildren(icon(on ? Minimize : Maximize));
  fullscreenButton.setAttribute('aria-label', label);
  fullscreenButton.title = `${label} (F)`;
}

document.addEventListener('fullscreenchange', renderFullscreen);
stage.addEventListener('dblclick', (event) => {
  if (!controls.contains(event.target as Node)) toggleFullscreen();
});

// Controls show on any activity and fade out when left alone.
let idleTimer = 0;
function wake(): void {
  stage.classList.add('awake');
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => stage.classList.remove('awake'), 2500);
}
for (const type of ['pointermove', 'pointerdown', 'keydown'] as const) {
  stage.ownerDocument.addEventListener(type, wake, { passive: true });
}

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'm' || event.key === 'M') setSound(video.muted);
  if (event.key === 'f' || event.key === 'F') toggleFullscreen();
});

// A background tab pulls no video; it picks up again on return.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) feed.stop();
  else feed.start();
});

function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', label);
  el.addEventListener('click', onClick);
  controls.append(el);
  return el;
}

function icon(node: IconNode): SVGElement {
  const svg = createElement(node);
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

renderMute();
renderFullscreen();
// Set after first paint, so even the first label waits its beat before showing.
status.textContent = LABELS.connecting;
requestAnimationFrame(() => {
  stage.dataset.state = 'connecting';
  if (!document.hidden) feed.start();
});
