import type { BoardGame, LiveView } from '../core/views';

export type Role = 'board' | 'player';

export type ClientMsg =
  | { t: 'hello'; role: Role; deviceId: string }
  | { t: 'claim'; teamId: string }
  | { t: 'release'; teamId: string }
  | { t: 'buzz'; teamId: string }
  | { t: 'ping'; ts: number };

export type HostMsg =
  | { t: 'game'; game: BoardGame }
  | { t: 'live'; live: LiveView }
  | { t: 'pong'; ts: number };

export type ConnStatus = 'connecting' | 'online' | 'offline' | 'id-taken' | 'error';

export function isClientMsg(x: unknown): x is ClientMsg {
  return !!x && typeof x === 'object' && typeof (x as { t?: unknown }).t === 'string';
}

