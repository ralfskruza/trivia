import { initialLive, validateState } from './core/game';
import type { GameState } from './core/types';

const key = (boardId: string) => `trivia:board:${boardId.toUpperCase()}`;
const INDEX = 'trivia:boards';

export function loadState(boardId: string): GameState | null {
  try {
    const raw = localStorage.getItem(key(boardId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!validateState(data)) return null;
    // forward-compat defaults
    data.live = { ...initialLive(), ...data.live };
    return data;
  } catch {
    return null;
  }
}

/** Returns false when storage quota is exceeded. */
export function saveState(state: GameState): boolean {
  try {
    localStorage.setItem(key(state.boardId), JSON.stringify(state));
    const list = listBoards().filter((b) => b.id !== state.boardId);
    list.unshift({ id: state.boardId, title: state.game.title, updated: Date.now() });
    localStorage.setItem(INDEX, JSON.stringify(list.slice(0, 30)));
    return true;
  } catch (e) {
    console.error('saveState failed', e);
    return false;
  }
}

export function deleteState(boardId: string) {
  localStorage.removeItem(key(boardId));
  localStorage.setItem(INDEX, JSON.stringify(listBoards().filter((b) => b.id !== boardId)));
}

export function listBoards(): { id: string; title: string; updated: number }[] {
  try {
    const list = JSON.parse(localStorage.getItem(INDEX) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}

/**
 * Reads an image file and downscales it to keep localStorage + P2P payloads small.
 * SVG and GIF are kept as-is (unless very large).
 */
export function readImage(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        // keep transparency for PNG (logos), use JPEG/WebP for photos
        const out = file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
        resolve(out.length < dataUrl.length ? out : dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- GM PIN (device-local) ----------
const PIN_KEY = 'trivia:gmPinHash';
const PIN_SESSION = 'trivia:gmUnlocked';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('trivia-pin:' + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hasPin(): boolean {
  return !!localStorage.getItem(PIN_KEY);
}

export function isUnlocked(): boolean {
  return !hasPin() || sessionStorage.getItem(PIN_SESSION) === '1';
}

export async function setPin(pin: string | null) {
  if (!pin) localStorage.removeItem(PIN_KEY);
  else localStorage.setItem(PIN_KEY, await sha256(pin));
  sessionStorage.setItem(PIN_SESSION, '1');
}

export async function checkPin(pin: string): Promise<boolean> {
  const ok = (await sha256(pin)) === localStorage.getItem(PIN_KEY);
  if (ok) sessionStorage.setItem(PIN_SESSION, '1');
  return ok;
}
