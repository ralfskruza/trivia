import { useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BoardHeader } from '../components/BoardHeader';
import { Grid } from '../components/Grid';
import { appUrl, Modal, QR, StatusDot } from '../components/ui';
import {
  addCategory,
  addQuestion,
  createState,
  currentQuestion,
  gameReducer,
  moveCategory,
  removeCategory,
  removeQuestion,
  uid,
  updateCategory,
  updateQuestion,
  validateGame,
  validateState,
  type Action,
} from '../core/game';
import { cloneSample, EMPTY_GAME } from '../core/sample';
import type { Game, GameState, Question } from '../core/types';
import { useI18n } from '../i18n';
import { useHost, type HostInfo } from '../net/host';
import { checkPin, downloadJson, hasPin, isUnlocked, loadState, readImage, saveState, setPin } from '../storage';

export default function GmPage() {
  const { boardId = '' } = useParams();
  const id = boardId.toUpperCase();
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [initial, setInitial] = useState<GameState | null>(() => loadState(id));

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
  if (!initial) return <NoBoard boardId={id} onCreate={setInitial} />;
  return <GmPanel key={id} initial={initial} />;
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useI18n();
  const [pin, setPinValue] = useState('');
  const [err, setErr] = useState(false);
  return (
    <div className="center-page">
      <form
        className="card narrow"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await checkPin(pin)) onUnlock();
          else setErr(true);
        }}
      >
        <h2>{t('pin_enter')}</h2>
        <input className="input big" type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPinValue(e.target.value)} />
        {err && <p className="error">{t('pin_wrong')}</p>}
        <button className="btn primary big">{t('pin_unlock')}</button>
      </form>
    </div>
  );
}

function NoBoard({ boardId, onCreate }: { boardId: string; onCreate: (s: GameState) => void }) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const create = (s: GameState) => {
    saveState(s);
    onCreate(s);
  };
  return (
    <div className="center-page">
      <div className="card narrow">
        <p>{t('gm_noBoard', { id: boardId })}</p>
        <button className="btn primary big" onClick={() => { const { game, teams } = cloneSample(); create(createState(boardId, game, teams)); }}>
          {t('gm_createHere')} — {t('home_withSample')}
        </button>
        <button className="btn big" onClick={() => create(createState(boardId, structuredClone(EMPTY_GAME)))}>
          {t('gm_createHere')} — {t('home_empty')}
        </button>
        <button className="btn big" onClick={() => fileRef.current?.click()}>
          {t('gm_importHere')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              if (validateState(data)) create({ ...data, boardId });
              else if (validateGame(data)) create(createState(boardId, data));
              else alert(t('edit_invalidFile'));
            } catch {
              alert(t('edit_invalidFile'));
            }
          }}
        />
        <Link to="/" className="btn ghost">
          ←
        </Link>
      </div>
    </div>
  );
}

function GmPanel({ initial }: { initial: GameState }) {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(gameReducer, initial);
  const host = useHost(state.boardId, state, dispatch);
  const [editing, setEditing] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState<null | 'share' | 'settings'>(null);
  const [editQ, setEditQ] = useState<string | null>(null);
  const [storageFull, setStorageFull] = useState(false);

  // persist (debounced)
  useEffect(() => {
    const h = setTimeout(() => setStorageFull(!saveState(state)), 250);
    return () => clearTimeout(h);
  }, [state]);

  const cq = currentQuestion(state);
  const setGame = (game: Game) => dispatch({ type: 'SET_GAME', game });

  return (
    <div className="gm">
      <div className="gm-bar">
        <Link to="/" className="btn ghost small">⌂</Link>
        <strong className="gm-code">{state.boardId}</strong>
        <StatusDot status={host.status} />
        <span className="muted small">
          🖥 {host.boards} · 📱 {host.players}
        </span>
        <div className="spacer" />
        {state.live.phase === 'grid' && (
          <button className={`btn${editing ? ' primary' : ''}`} onClick={() => setEditing(!editing)}>
            ✎ {editing ? t('gm_doneEdit') : t('gm_edit')}
          </button>
        )}
        <button className="btn" onClick={() => setModal('share')}>
          ⧉ {t('gm_share')}
        </button>
        <button className="btn" onClick={() => setDrawer(true)}>
          👥 {t('gm_participants')}
        </button>
        <button className="btn ghost" onClick={() => setModal('settings')} aria-label={t('gm_settings')}>
          ⚙
        </button>
      </div>
      {storageFull && <div className="banner error">{t('gm_storageFull')}</div>}
      {host.status === 'id-taken' && <div className="banner error">{t('status_id-taken')}</div>}

      {state.live.phase === 'question' && cq ? (
        <QuestionView state={state} dispatch={dispatch} />
      ) : (
        <div className="gm-grid-wrap">
          {editing && <EditToolbar state={state} dispatch={dispatch} setGame={setGame} />}
          <BoardHeader title={state.game.title} logo={state.game.logo} />
          <Grid
            variant="gm"
            editing={editing}
            categories={state.game.categories}
            used={state.live.used}
            onCell={(qid) => (editing ? setEditQ(qid) : dispatch({ type: 'LAUNCH', questionId: qid }))}
            renderHeader={
              editing
                ? (c) => (
                    <div className="cat-edit">
                      <input
                        className="input"
                        value={c.name}
                        placeholder={t('edit_newCategory')}
                        onChange={(e) => setGame(updateCategory(state.game, c.id, { name: e.target.value }))}
                      />
                      <div className="row">
                        <button className="btn small" onClick={() => setGame(moveCategory(state.game, c.id, -1))}>◀</button>
                        <button className="btn small" onClick={() => setGame(moveCategory(state.game, c.id, 1))}>▶</button>
                        <button
                          className="btn small danger"
                          onClick={() => confirm(t('confirmDelete')) && setGame(removeCategory(state.game, c.id))}
                          title={t('edit_deleteCategory')}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  )
                : undefined
            }
            renderFooter={
              editing
                ? (c) => (
                    <button className="btn small" onClick={() => setGame(addQuestion(state.game, c.id))}>
                      {t('edit_addQuestion')}
                    </button>
                  )
                : undefined
            }
          />
          {state.game.categories.length === 0 && !editing && (
            <p className="muted center">
              <button className="btn primary" onClick={() => setEditing(true)}>✎ {t('gm_edit')}</button>
            </p>
          )}
        </div>
      )}

      {drawer && <ParticipantsDrawer state={state} dispatch={dispatch} host={host} onClose={() => setDrawer(false)} />}
      {modal === 'share' && <ShareModal boardId={state.boardId} onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {editQ && (
        <QuestionEditor
          key={editQ}
          state={state}
          questionId={editQ}
          onClose={() => setEditQ(null)}
          setGame={setGame}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}

// ---------------- Question view ----------------

function QuestionView({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const { t } = useI18n();
  const cq = currentQuestion(state)!;
  const { live } = state;
  const team = (id: string | null) => state.teams.find((x) => x.id === id);
  const buzzed = team(live.buzzedTeamId);
  const correct = team(live.correctTeamId);
  const pts = cq.question.points;
  const canJudge = !!live.buzzedTeamId && !live.correctTeamId;

  let status: React.ReactNode;
  if (correct) status = <div className="buzz-status correct">✓ {t('gm_correctBy')} <b>{correct.name}</b></div>;
  else if (buzzed) status = <div className="buzz-status buzzed">🔔 {t('gm_buzzedFirst')} <b>{buzzed.name}</b></div>;
  else if (live.buzzerOpen) status = <div className="buzz-status open">{t('gm_buzzersOpen')}</div>;
  else status = <div className="buzz-status locked">{t('gm_buzzersLocked')}</div>;

  return (
    <div className="gm-question">
      <div className="gm-q-main">
        <div className="gm-q-meta">
          <span className="pill">{cq.category.name}</span>
          <span className="pill gold">{pts}</span>
        </div>
        <p className="gm-q-text">{cq.question.question || <i className="muted">{t('edit_empty')}</i>}</p>
        {cq.question.image && <img className="gm-q-img" src={cq.question.image} alt="" />}
        <div className={`gm-answer${live.revealed ? ' revealed' : ''}`}>
          <span className="label">{t('gm_answer')}</span>
          <span>{cq.question.answer}</span>
        </div>
        {cq.question.notes && (
          <div className="gm-notes">
            <span className="label">{t('gm_notes')}</span>
            <span>{cq.question.notes}</span>
          </div>
        )}
      </div>
      <div className="gm-q-side">
        {status}
        {state.teams.length === 0 && <p className="error small">{t('gm_noTeams')}</p>}
        {live.lockedOut.length > 0 && (
          <p className="muted small">
            {t('gm_lockedOut')} {live.lockedOut.map((id) => team(id)?.name).filter(Boolean).join(', ')}
          </p>
        )}
        {!live.buzzerOpen && !live.buzzedTeamId && !live.revealed && (
          <button className="btn huge open-btn" onClick={() => dispatch({ type: 'OPEN_BUZZERS' })}>
            {t('gm_openBuzzers')}
          </button>
        )}
        <div className="judge">
          <button className="btn huge success" disabled={!canJudge} onClick={() => dispatch({ type: 'CORRECT' })}>
            {t('gm_correct', { pts })}
          </button>
          <button className="btn huge danger" disabled={!canJudge} onClick={() => dispatch({ type: 'INCORRECT' })}>
            {t('gm_incorrect', { pts })}
          </button>
        </div>
        <button className="btn big" disabled={!!live.correctTeamId} onClick={() => dispatch({ type: 'RESET_BUZZER' })}>
          {t('gm_reset')}
        </button>
        <button className="btn big" disabled={live.revealed} onClick={() => dispatch({ type: 'REVEAL' })}>
          {t('gm_reveal')}
        </button>
        <button className="btn big ghost-border" onClick={() => dispatch({ type: 'RETURN_TO_GRID' })}>
          {t('gm_back')}
        </button>
      </div>
    </div>
  );
}

// ---------------- Editing ----------------

function EditToolbar({ state, dispatch, setGame }: { state: GameState; dispatch: (a: Action) => void; setGame: (g: Game) => void }) {
  const { t } = useI18n();
  const logoRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const g = state.game;
  return (
    <div className="edit-toolbar">
      <label className="field grow">
        <span>{t('edit_title')}</span>
        <input className="input" value={g.title} onChange={(e) => setGame({ ...g, title: e.target.value })} />
      </label>
      <div className="field">
        <span>{t('edit_logo')}</span>
        <div className="row">
          <button className="btn small" onClick={() => logoRef.current?.click()}>{t('edit_upload')}</button>
          {g.logo && (
            <button className="btn small danger" onClick={() => setGame({ ...g, logo: undefined })}>
              {t('edit_removeLogo')}
            </button>
          )}
        </div>
        <input
          ref={logoRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const src = await readImage(f, 600);
            setGame({ ...g, logo: { src, height: g.logo?.height ?? 100 } });
          }}
        />
      </div>
      {g.logo && (
        <label className="field">
          <span>
            {t('edit_logoSize')}: {g.logo.height}px
          </span>
          <input
            type="range"
            min={40}
            max={300}
            step={5}
            value={g.logo.height}
            onChange={(e) => setGame({ ...g, logo: { ...g.logo!, height: Number(e.target.value) } })}
          />
        </label>
      )}
      <div className="row wrap">
        <button className="btn primary" onClick={() => setGame(addCategory(g, t('edit_newCategory')))}>
          {t('edit_addCategory')}
        </button>
        <button className="btn" onClick={() => downloadJson(`trivia-${state.boardId}.json`, { title: g.title, categories: g.categories, logo: g.logo })}>
          {t('edit_export')}
        </button>
        <button className="btn" onClick={() => importRef.current?.click()}>{t('edit_import')}</button>
        <button
          className="btn"
          onClick={() => confirm(t('edit_confirmReplace')) && setGame(cloneSample().game)}
        >
          {t('edit_loadSample')}
        </button>
        <button className="btn" onClick={() => dispatch({ type: 'RESET_USED' })}>{t('edit_resetUsed')}</button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              const game = validateGame(data) ? data : validateState(data) ? data.game : null;
              if (!game) return alert(t('edit_invalidFile'));
              if (confirm(t('edit_confirmReplace'))) setGame(game);
            } catch {
              alert(t('edit_invalidFile'));
            }
          }}
        />
      </div>
    </div>
  );
}

function QuestionEditor({
  state,
  questionId,
  onClose,
  setGame,
  dispatch,
}: {
  state: GameState;
  questionId: string;
  onClose: () => void;
  setGame: (g: Game) => void;
  dispatch: (a: Action) => void;
}) {
  const { t } = useI18n();
  const original = state.game.categories.flatMap((c) => c.questions).find((q) => q.id === questionId);
  const [q, setQ] = useState<Question | undefined>(original && { ...original });
  const imgRef = useRef<HTMLInputElement>(null);
  if (!q) return null;
  const used = state.live.used.includes(questionId);
  const save = () => {
    const { id: _id, ...patch } = q;
    setGame(updateQuestion(state.game, questionId, { ...patch, points: Number(patch.points) || 0 }));
    onClose();
  };
  return (
    <Modal title={t('edit_question')} onClose={onClose} wide>
      <div className="form">
        <label className="field">
          <span>{t('edit_points')}</span>
          <input className="input" type="number" step={50} value={q.points} onChange={(e) => setQ({ ...q, points: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>{t('edit_question')}</span>
          <textarea className="input" rows={3} value={q.question} onChange={(e) => setQ({ ...q, question: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('edit_answer')}</span>
          <input className="input" value={q.answer} onChange={(e) => setQ({ ...q, answer: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('edit_notes')}</span>
          <textarea className="input" rows={2} value={q.notes ?? ''} onChange={(e) => setQ({ ...q, notes: e.target.value || undefined })} />
        </label>
        <div className="field">
          <span>{t('edit_image')}</span>
          {q.image && <img className="edit-img" src={q.image} alt="" />}
          <div className="row">
            <button className="btn" onClick={() => imgRef.current?.click()}>{t('edit_upload')}</button>
            {q.image && (
              <button className="btn danger" onClick={() => setQ({ ...q, image: undefined })}>
                {t('edit_removeImage')}
              </button>
            )}
          </div>
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setQ({ ...q, image: await readImage(f) });
            }}
          />
        </div>
        <div className="row wrap between">
          <div className="row wrap">
            <button
              className="btn danger"
              onClick={() => {
                if (!confirm(t('confirmDelete'))) return;
                setGame(removeQuestion(state.game, questionId));
                onClose();
              }}
            >
              🗑 {t('edit_deleteQuestion')}
            </button>
            <button className="btn" onClick={() => dispatch({ type: 'TOGGLE_USED', questionId })}>
              {used ? t('edit_markUnused') : t('edit_markUsed')}
            </button>
          </div>
          <div className="row">
            <button className="btn" onClick={onClose}>{t('edit_cancel')}</button>
            <button className="btn primary" onClick={save}>{t('edit_save')}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Participants drawer ----------------

function ParticipantsDrawer({
  state,
  dispatch,
  host,
  onClose,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  host: HostInfo;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [custom, setCustom] = useState<Record<string, string>>({});
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{t('p_title')}</h2>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          {state.teams.map((team) => {
            const owner = state.live.claims[team.id];
            const online = owner && host.onlineDevices.includes(owner);
            return (
              <div key={team.id} className="team-card">
                <div className="row between">
                  <input
                    className="input team-name"
                    value={team.name}
                    onChange={(e) => dispatch({ type: 'RENAME_TEAM', teamId: team.id, name: e.target.value })}
                  />
                  <span className="team-score">{team.score}</span>
                </div>
                <div className="score-btns">
                  {[-100, -50, 50, 100].map((d) => (
                    <button
                      key={d}
                      className={`btn big ${d < 0 ? 'danger' : 'success'}`}
                      onClick={() => dispatch({ type: 'ADJUST_SCORE', teamId: team.id, delta: d })}
                    >
                      {d > 0 ? `+${d}` : `−${-d}`}
                    </button>
                  ))}
                </div>
                <div className="row">
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    placeholder={t('p_custom')}
                    value={custom[team.id] ?? ''}
                    onChange={(e) => setCustom({ ...custom, [team.id]: e.target.value })}
                  />
                  <button
                    className="btn"
                    onClick={() => {
                      const d = Number(custom[team.id]);
                      if (d) dispatch({ type: 'ADJUST_SCORE', teamId: team.id, delta: d });
                      setCustom({ ...custom, [team.id]: '' });
                    }}
                  >
                    ±
                  </button>
                </div>
                <div className="row between small">
                  <span className={owner ? (online ? 'ok' : 'muted') : 'muted'}>
                    {owner ? `📱 ${t('p_claimed')}${online ? ` · ${t('p_online')}` : ''}` : t('p_free')}
                  </span>
                  <div className="row">
                    {owner && (
                      <button className="btn small" onClick={() => dispatch({ type: 'RELEASE', teamId: team.id })}>
                        {t('p_release')}
                      </button>
                    )}
                    <button
                      className="btn small danger"
                      onClick={() => confirm(t('confirmDelete')) && dispatch({ type: 'REMOVE_TEAM', teamId: team.id })}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="row wrap">
            <button
              className="btn primary big"
              onClick={() =>
                dispatch({ type: 'ADD_TEAM', team: { id: uid('t_'), name: `${t('p_newTeam')} ${state.teams.length + 1}`, score: 0 } })
              }
            >
              {t('p_addTeam')}
            </button>
            <button className="btn big" onClick={() => confirm(t('p_confirmReset')) && dispatch({ type: 'RESET_SCORES' })}>
              {t('p_resetScores')}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ---------------- Share & settings ----------------

function CopyLink({ url }: { url: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="row">
      <input className="input mono" readOnly value={url} onFocus={(e) => e.target.select()} />
      <button
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* ignore */
          }
        }}
      >
        {copied ? t('share_copied') : t('share_copy')}
      </button>
    </div>
  );
}

function ShareModal({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const { t } = useI18n();
  const playerUrl = appUrl(`/player/${boardId}`);
  const boardUrl = appUrl(`/board/${boardId}`);
  const hubUrl = appUrl(`/hub/${boardId}`);
  return (
    <Modal title={`${t('home_code')}: ${boardId}`} onClose={onClose} wide>
      <div className="share">
        <div className="share-qr">
          <h3>{t('share_players')}</h3>
          <QR text={playerUrl} size={240} />
          <div className="big-code">{boardId}</div>
          <CopyLink url={playerUrl} />
        </div>
        <div className="share-links">
          <h3>{t('share_board')}</h3>
          <CopyLink url={boardUrl} />
          <a className="btn primary" href={boardUrl} target="_blank" rel="noreferrer">
            🖥 {t('gm_openBoard')}
          </a>
          <h3>{t('share_hub')}</h3>
          <CopyLink url={hubUrl} />
        </div>
      </div>
    </Modal>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang } = useI18n();
  const [pin, setPinValue] = useState('');
  const [has, setHas] = useState(hasPin());
  const navigate = useNavigate();
  return (
    <Modal title={t('gm_settings')} onClose={onClose}>
      <div className="form">
        <div className="field">
          <span>{t('settings_lang')}</span>
          <div className="row">
            <button className={`btn${lang === 'lv' ? ' primary' : ''}`} onClick={() => setLang('lv')}>Latviešu</button>
            <button className={`btn${lang === 'en' ? ' primary' : ''}`} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
        <div className="field">
          <span>{t('settings_pin')}</span>
          <p className="muted small">{t('settings_pinHint')}</p>
          <div className="row">
            <input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPinValue(e.target.value)} />
            <button
              className="btn primary"
              disabled={pin.length < 3}
              onClick={async () => {
                await setPin(pin);
                setPinValue('');
                setHas(true);
              }}
            >
              {t('settings_setPin')}
            </button>
          </div>
          {has && (
            <button
              className="btn danger"
              onClick={async () => {
                await setPin(null);
                setHas(false);
              }}
            >
              {t('settings_clearPin')}
            </button>
          )}
        </div>
        <div className="row between">
          <button className="btn ghost" onClick={() => navigate('/')}>⌂</button>
          <button className="btn" onClick={onClose}>{t('settings_close')}</button>
        </div>
      </div>
    </Modal>
  );
}

