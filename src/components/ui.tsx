import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { useI18n } from '../i18n';
import type { ConnStatus } from '../net/protocol';

export function StatusDot({ status }: { status: ConnStatus }) {
  const { t } = useI18n();
  return (
    <span className={`status status-${status}`} title={t(`status_${status}` as const)}>
      <i />
      <span className="status-text">{t(`status_${status}` as const)}</span>
    </span>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function QR({ text, size = 200 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { width: size, margin: 1 }).then(setSrc).catch(() => setSrc(''));
  }, [text, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt={text} /> : null;
}

/** Absolute URL for a hash route, works on GitHub Pages sub-paths. */
export function appUrl(route: string): string {
  const base = window.location.href.split('#')[0];
  return `${base}#${route}`;
}
