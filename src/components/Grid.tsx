import type { ReactNode } from 'react';

interface GridCategory {
  id: string;
  name: string;
  questions: { id: string; points: number }[];
}

interface Props {
  categories: GridCategory[];
  used: string[];
  onCell?: (questionId: string) => void;
  /** optional custom header rendering (edit mode) */
  renderHeader?: (c: GridCategory) => ReactNode;
  renderFooter?: (c: GridCategory) => ReactNode;
  emptyLabel?: string;
  variant: 'board' | 'gm';
  editing?: boolean;
}

/** Category × points grid shared by audience board and GM panel. */
export function Grid({ categories, used, onCell, renderHeader, renderFooter, variant, editing }: Props) {
  const rows = Math.max(0, ...categories.map((c) => c.questions.length));
  return (
    <div
      className={`grid grid-${variant}${editing ? ' editing' : ''}`}
      style={{ gridTemplateColumns: `repeat(${Math.max(categories.length, 1)}, minmax(0, 1fr))` }}
    >
      {categories.map((c) => (
        <div key={c.id} className="grid-col">
          <div className="grid-head">{renderHeader ? renderHeader(c) : <span>{c.name}</span>}</div>
          {Array.from({ length: rows }, (_, i) => {
            const q = c.questions[i];
            if (!q) return <div key={i} className="cell cell-empty" />;
            const isUsed = used.includes(q.id);
            return (
              <button
                key={q.id}
                className={`cell${isUsed ? ' used' : ''}`}
                onClick={onCell ? () => onCell(q.id) : undefined}
                disabled={!onCell}
              >
                {q.points}
              </button>
            );
          })}
          {renderFooter && <div className="grid-foot">{renderFooter(c)}</div>}
        </div>
      ))}
    </div>
  );
}

