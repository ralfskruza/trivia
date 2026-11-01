import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createState, generateBoardId } from '../core/game';
import { cloneSample, EMPTY_GAME } from '../core/sample';
import { LangToggle, useI18n } from '../i18n';
import { deleteState, listBoards, saveState } from '../storage';

export default function HomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [boards, setBoards] = useState(listBoards());
  const [code, setCode] = useState('');

  const create = (sample: boolean) => {
    const id = generateBoardId();
    const { game, teams } = sample ? cloneSample() : { game: structuredClone(EMPTY_GAME), teams: [] };
    saveState(createState(id, game, teams));
    navigate(`/gm/${id}`);
  };

  return (
    <div className="home">
      <div className="home-head">
        <h1>🎯 {t('appName')}</h1>
        <LangToggle />
      </div>
      <section className="card">
        <h2>{t('home_createBoard')}</h2>
        <div className="row wrap">
          <button className="btn primary big" onClick={() => create(true)}>
            {t('home_withSample')}
          </button>
          <button className="btn big" onClick={() => create(false)}>
            {t('home_empty')}
          </button>
        </div>
      </section>
      {boards.length > 0 && (
        <section className="card">
          <h2>{t('home_myBoards')}</h2>
          <ul className="board-list">
            {boards.map((b) => (
              <li key={b.id}>
                <Link to={`/gm/${b.id}`} className="board-link">
                  <b className="mono">{b.id}</b> <span>{b.title}</span>
                </Link>
                <button
                  className="btn small danger"
                  onClick={() => {
                    if (!confirm(t('confirmDelete'))) return;
                    deleteState(b.id);
                    setBoards(listBoards());
                  }}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card">
        <h2>{t('home_code')}</h2>
        <div className="row wrap">
          <input
            className="input mono"
            value={code}
            maxLength={12}
            placeholder="ABC123"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn big" disabled={!code} onClick={() => navigate(`/player/${code.trim()}`)}>
            📱 {t('home_join')}
          </button>
          <button className="btn big" disabled={!code} onClick={() => navigate(`/board/${code.trim()}`)}>
            🖥 {t('home_openBoard')}
          </button>
        </div>
      </section>
    </div>
  );
}

