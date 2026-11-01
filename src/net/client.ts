import Peer, { type DataConnection } from 'peerjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hostPeerId, PEER_OPTIONS } from '../config';
import type { BoardGame, LiveView } from '../core/views';
import type { ClientMsg, ConnStatus, HostMsg, Role } from './protocol';

export function getDeviceId(): string {
  const KEY = 'trivia:deviceId';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = 'd_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export interface ClientState {
  status: ConnStatus;
  game: BoardGame | null;
  live: LiveView | null;
  send: (msg: ClientMsg) => boolean;
  deviceId: string;
}

/** Connects a board or player device to the GM host and keeps reconnecting. */
export function useClient(boardId: string | null, role: Role): ClientState {
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [game, setGame] = useState<BoardGame | null>(null);
  const [live, setLive] = useState<LiveView | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const deviceId = useRef(getDeviceId()).current;

  useEffect(() => {
    if (!boardId) return;
    let destroyed = false;
    let peer: Peer | null = null;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    let lastPong = Date.now();

    const scheduleConnect = (ms: number) => {
      window.clearTimeout(retryTimer);
      if (!destroyed) retryTimer = window.setTimeout(connect, ms);
    };

    const connect = () => {
      if (destroyed || !peer || peer.destroyed) return;
      if (peer.disconnected) {
        peer.reconnect();
        scheduleConnect(2000);
        return;
      }
      connRef.current?.close();
      const conn = peer.connect(hostPeerId(boardId), { reliable: true });
      connRef.current = conn;
      const openTimeout = window.setTimeout(() => {
        if (!conn.open) {
          conn.close();
          setStatus('offline');
          scheduleConnect(2000);
        }
      }, 8000);
      conn.on('open', () => {
        window.clearTimeout(openTimeout);
        lastPong = Date.now();
        conn.send({ t: 'hello', role, deviceId } satisfies ClientMsg);
        setStatus('online');
      });
      conn.on('data', (raw) => {
        const msg = raw as HostMsg;
        lastPong = Date.now();
        if (msg.t === 'game') setGame(msg.game);
        else if (msg.t === 'live') setLive(msg.live);
      });
      const lost = () => {
        if (connRef.current !== conn) return;
        connRef.current = null;
        setStatus('offline');
        scheduleConnect(1500);
      };
      conn.on('close', lost);
      conn.on('error', lost);
    };

    peer = new Peer(PEER_OPTIONS);
    peer.on('open', () => connect());
    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'peer-unavailable') {
        // host not online yet
        setStatus('offline');
        scheduleConnect(2500);
      } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(err.type ?? '')) {
        setStatus('offline');
        scheduleConnect(3000);
      } else {
        console.warn('client peer error', err.type, err);
      }
    });
    peer.on('disconnected', () => {
      if (!destroyed && peer && !peer.destroyed) setTimeout(() => peer && !peer.destroyed && peer.reconnect(), 1500);
    });

    // heartbeat: detects silently dead connections (e.g. GM tablet slept)
    pingTimer = window.setInterval(() => {
      const c = connRef.current;
      if (c?.open) {
        try {
          c.send({ t: 'ping', ts: Date.now() } satisfies ClientMsg);
        } catch {
          /* ignore */
        }
        if (Date.now() - lastPong > 12000) {
          connRef.current = null;
          c.close();
          setStatus('offline');
          scheduleConnect(500);
        }
      }
    }, 4000);

    return () => {
      destroyed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      connRef.current?.close();
      connRef.current = null;
      peer?.destroy();
    };
  }, [boardId, role, deviceId]);

  const send = useCallback((msg: ClientMsg) => {
    const c = connRef.current;
    if (!c?.open) return false;
    c.send(msg);
    return true;
  }, []);

  return { status, game, live, send, deviceId };
}

