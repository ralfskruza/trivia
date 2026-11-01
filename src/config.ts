/**
 * Networking configuration.
 * By default the free public PeerJS cloud signaling server is used.
 * To self-host, run `npx peerjs --port 9000` and set host/port/path/secure below.
 */
import type { PeerOptions } from 'peerjs';

export const PEER_ID_PREFIX = 'trivia-lv-board-';

export const PEER_OPTIONS: PeerOptions = {
  // host: 'your-peer-server.example.com',
  // port: 443,
  // path: '/',
  // secure: true,
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Add a TURN server here for restrictive networks, e.g.:
      // { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' },
    ],
  },
};

export function hostPeerId(boardId: string): string {
  return PEER_ID_PREFIX + boardId.toUpperCase();
}

