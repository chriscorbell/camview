import { useCallback, useEffect, useRef, useState } from 'react';

import { VideoRTC } from './vendor/video-rtc.js';

const STREAM = 'camera';
const VIDEO_STREAM_TAG = 'video-stream';

if (!customElements.get(VIDEO_STREAM_TAG)) {
  customElements.define(VIDEO_STREAM_TAG, VideoRTC);
}

type StreamStatus = 'connecting' | 'live' | 'error';

type StreamState = {
  detail?: string;
  overlayText: string;
  status: StreamStatus;
  statusText: string;
};

type VideoStreamElement = InstanceType<typeof VideoRTC>;

const connectingState: StreamState = {
  overlayText: 'Connecting to camera...',
  status: 'connecting',
  statusText: 'connecting...',
};

export function App() {
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const [streamState, setStreamState] = useState<StreamState>(connectingState);
  const [isIdle, setIsIdle] = useState(false);

  const setLive = useCallback(() => {
    setStreamState({
      overlayText: '',
      status: 'live',
      statusText: 'live',
    });
  }, []);

  const setConnecting = useCallback((statusText: string, overlayText = statusText) => {
    setStreamState({
      overlayText,
      status: 'connecting',
      statusText,
    });
  }, []);

  useEffect(() => {
    const host = playerHostRef.current;
    if (!host) return;

    const player = document.createElement(VIDEO_STREAM_TAG) as VideoStreamElement;
    let watchedVideo: HTMLVideoElement | null = null;
    let errorTimer = 0;

    const setError = () => {
      if (player.video && player.video.readyState >= 2) return;

      setStreamState({
        detail:
          'Check that CAMERA_RTSP_URL is correct and the camera is online. See container logs for go2rtc errors.',
        overlayText: 'Cannot reach the camera stream.',
        status: 'error',
        statusText: 'Cannot reach the camera stream.',
      });
    };

    const handleLoadedData = () => {
      window.clearTimeout(errorTimer);
      setLive();
    };
    const handleWaiting = () => setConnecting('buffering...');
    const handleStalled = () => setConnecting('reconnecting...');

    player.mode = 'webrtc,mse,hls,mjpeg';
    player.background = false;
    player.addEventListener('loadeddata', handleLoadedData);
    host.appendChild(player);

    const watchTimer = window.setInterval(() => {
      if (!player.video) return;

      window.clearInterval(watchTimer);
      watchedVideo = player.video;
      watchedVideo.removeAttribute('controls');
      watchedVideo.controls = false;
      watchedVideo.addEventListener('loadeddata', handleLoadedData);
      watchedVideo.addEventListener('playing', setLive);
      watchedVideo.addEventListener('waiting', handleWaiting);
      watchedVideo.addEventListener('stalled', handleStalled);
    }, 100);

    errorTimer = window.setTimeout(setError, 12000);
    player.src = `/api/ws?src=${STREAM}`;

    return () => {
      window.clearInterval(watchTimer);
      window.clearTimeout(errorTimer);
      player.removeEventListener('loadeddata', handleLoadedData);
      watchedVideo?.removeEventListener('loadeddata', handleLoadedData);
      watchedVideo?.removeEventListener('playing', setLive);
      watchedVideo?.removeEventListener('waiting', handleWaiting);
      watchedVideo?.removeEventListener('stalled', handleStalled);
      if (player.video) player.ondisconnect();
      player.remove();
    };
  }, [setConnecting, setLive]);

  useEffect(() => {
    let idleTimer = 0;

    const poke = () => {
      setIsIdle(false);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setIsIdle(true), 3000);
    };

    window.addEventListener('mousemove', poke);
    window.addEventListener('touchstart', poke);
    window.addEventListener('keydown', poke);
    poke();

    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('mousemove', poke);
      window.removeEventListener('touchstart', poke);
      window.removeEventListener('keydown', poke);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  const showOverlay = streamState.status !== 'live';

  return (
    <main className={isIdle ? 'app idle' : 'app'}>
      <section className="stage" onDoubleClick={toggleFullscreen}>
        <div className="player-host" ref={playerHostRef} />
      </section>

      <header className="bar">
        <span className="title">camview</span>
        <span className="status">
          <span className={`dot ${streamState.status}`} />
          <span>{streamState.statusText}</span>
        </span>
      </header>

      <div className={showOverlay ? `overlay ${streamState.status}` : 'overlay hidden'}>
        <div className="spinner" />
        <div className="overlay-text">
          {streamState.overlayText}
          {streamState.detail ? <div className="err-detail">{streamState.detail}</div> : null}
        </div>
      </div>
    </main>
  );
}
