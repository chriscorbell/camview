export class VideoRTC extends HTMLElement {
  DISCONNECT_TIMEOUT: number;
  RECONNECT_TIMEOUT: number;
  CODECS: string[];
  background: boolean;
  connectTS: number;
  disconnectTID: number;
  media: string;
  mode: string;
  mseCodecs: string;
  ondata: ((data: ArrayBuffer) => void) | null;
  onmessage: Record<string, (message: { type: string; value: string }) => void> | null;
  pc: RTCPeerConnection | null;
  pcConfig: RTCConfiguration;
  pcState: number;
  reconnectTID: number;
  video: HTMLVideoElement | null;
  visibilityCheck: boolean;
  visibilityThreshold: number;
  ws: WebSocket | null;
  wsState: number;
  wsURL: string | URL;

  set src(value: string | URL);

  static btoa(buffer: ArrayBuffer): string;
  codecs(isSupported: (type: string) => boolean): string;
  connectedCallback(): void;
  createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit>;
  disconnectedCallback(): void;
  onclose(): boolean;
  onconnect(): boolean;
  ondisconnect(): void;
  onhls(): void;
  oninit(): void;
  onmjpeg(): void;
  onmp4(): void;
  onmse(): void;
  onopen(): string[];
  onpcvideo(video: HTMLVideoElement): void;
  onwebrtc(): void;
  play(): void;
  send(value: object): void;
}
