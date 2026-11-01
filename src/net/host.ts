import Peer, { type DataConnection } from 'peerjs';
import { useEffect, useRef, useState } from 'react';
import { hostPeerId, PEER_OPTIONS } from '../config';
import type { Action } from '../core/game';
import type { GameState } from '../core/types';
import { toBoardGame, toLiveView } from '../core/views';
import { isClientMsg, type ConnStatus, type HostMsg, type Role } from './protocol';

interface Client {
  conn: DataConnection;
  role: Role | null;
  deviceId: string | null;
  lastSeen: number;
}

export interface HostInfo {
  status: ConnStatus;
  boards: number;
  players: number;
  /** deviceIds currently connected */
  onlineDevices: string[];
}

const STALE_MS = 15000;

/**
 * Runs the authoritative PeerJS host on the GM device.
 * Board + player clients connect to `hostPeerId(boardId)`.
 */
export function useHost(boardId: string, state: GameState, dispatch: (a: Action) => void, enabled = true): HostInfo {
  const [info, setInfo] = useState<HostInfo>({ status: 'connecting', boards: 0, players: 0, onlineDevices: [] });
  const clients = useRef(new Map<string, Client>());
  const stateRef = useRef(state);
  const dispatchRef = useRef(dispatch);
  stateRef.current = state;
  dispatchRef.current = dispatch;

  const send = (c: Client, msg: HostMsg) => {
    if (c.conn.open) {
      try {
        c.conn.send(msg);
      } catch (e) {
        console.warn('send failed', e);
      }
    }
  };

  const sendFull = (c: Client) => {
    const s = stateRef.current;
    if (c.role === 'board') send(c, { t: 'game', game: toBoardGame(s) });
    send(c, { t: 'live', live: toLiveView(s, c.deviceId) });
  };

  const refreshInfo = (status?: ConnStatus) => {
    const list = [...clients.current.values()];
    setInfo((prev) => ({
      status: status ?? prev.status,
      boards: list.filter((c) => c.role === 'board').length,
      players: list.filter((c) => c.role === 'player').length,
      onlineDevices: [...new Set(list.filter((c) => c.role === 'player').map((c) => c.deviceId!))],
    }));
  };

  useEffect(() => {
    if (!enabled) return;
    let peer: Peer | null = null;
    let destroyed = false;
    let retryTimer: number | undefined;
    let attempts = 0;

    const start = () => {
      if (destroyed) return;
      refreshInfo('connecting');
      peer = new Peer(hostPeerId(boardId), PEER_OPTIONS);

      peer.on('open', () => {
        attempts = 0;
        refreshInfo('online');
      });

      peer.on('connection', (conn) => {
        const client: Client = { conn, role: null, deviceId: null, lastSeen: Date.now() };
        conn.on('open', () => {
          clients.current.set(conn.connectionId, client);
        });
        conn.on('data', (raw) => {
          client.lastSeen = Date.now();
          if (!isClientMsg(raw)) return;
          const msg = raw;
          switch (msg.t) {
            case 'hello':
              client.role = msg.role;
              client.deviceId = String(msg.deviceId).slice(0, 64);
              clients.current.set(conn.connectionId, client);
              sendFull(client);
              refreshInfo();
              break;
            case 'ping':
              send(client, { t: 'pong', ts: msg.ts });
              break;
            case 'buzz':
              if (client.role === 'player' && client.deviceId) {
                dispatchRef.current({ type: 'BUZZ', teamId: msg.teamId, deviceId: client.deviceId });
              }
              break;
            case 'claim':
              if (client.role === 'player' && client.deviceId) {
                dispatchRef.current({ type: 'CLAIM', teamId: msg.teamId, deviceId: client.deviceId });
              }
              break;
            case 'release':
              if (client.role === 'player' && stateRef.current.live.claims[msg.teamId] === client.deviceId) {
                dispatchRef.current({ type: 'RELEASE', teamId: msg.teamId });
              }
              break;
          }
        });
        const drop = () => {
          clients.current.delete(conn.connectionId);
          refreshInfo();
        };
        conn.on('close', drop);
        conn.on('error', drop);
      });

      peer.on('disconnected', () => {
        // lost signaling server; existing P2P links keep working
        if (!destroyed && peer && !peer.destroyed) {
          setTimeout(() => peer && !peer.destroyed && peer.reconnect(), 1500);
        }
      });

      peer.on('error', (err: { type?: string }) => {
        console.warn('host peer error', err.type, err);
        if (err.type === 'unavailable-id') {
          // ID may still be held by our previous session (e.g. after refresh) — retry a few times
          peer?.destroy();
          attempts++;
          if (attempts <= 5) {
            refreshInfo('connecting');
            retryTimer = window.setTimeout(start, 3000);
          } else {
            refreshInfo('id-taken');
          }
        } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type ?? '')) {
          refreshInfo('offline');
          peer?.destroy();
          retryTimer = window.setTimeout(start, 3000);
        }
      });
    };

    start();

    const prune = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, c] of clients.current) {
        if (!c.conn.open || now - c.lastSeen > STALE_MS) {
          clients.current.delete(id);
          c.conn.close();
          changed = true;
        }
      }
      if (changed) refreshInfo();
    }, 5000);

    return () => {
      destroyed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(prune);
      clients.current.clear();
      peer?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, enabled]);

  // Broadcast on every state change; game content only when it changed.
  const lastGame = useRef<unknown>(null);
  useEffect(() => {
    const gameChanged = lastGame.current !== state.game;
    lastGame.current = state.game;
    const boardGame = gameChanged ? toBoardGame(state) : null;
    for (const c of clients.current.values()) {
      if (!c.role) continue;
      if (boardGame && c.role === 'board') send(c, { t: 'game', game: boardGame });
      send(c, { t: 'live', live: toLiveView(state, c.deviceId) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return info;
}

