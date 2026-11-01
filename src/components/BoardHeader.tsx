import type { Logo } from '../core/types';

/** Title + logo header. Logo height drives header height so the grid below never overlaps. */
export function BoardHeader({ title, logo, right }: { title: string; logo?: Logo; right?: React.ReactNode }) {
  return (
    <header className="board-header" style={{ minHeight: logo ? logo.height + 16 : undefined }}>
      <h1 className="board-title">{title}</h1>
      <div className="board-header-right">
        {right}
        {logo && <img className="board-logo" src={logo.src} style={{ height: logo.height }} alt="logo" />}
      </div>
    </header>
  );
}

