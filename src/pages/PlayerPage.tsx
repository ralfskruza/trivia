import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { StatusDot } from '../components/ui';
import type { LiveView } from '../core/views';
import { LangToggle, useI18n } from '../i18n';
import { useClient, type ClientState } from '../net/client';

/** /dalibnieks — enter a join code. */
export function JoinPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const go = (hub = false) => {
    const c = code.trim().toUpperCase();
    if (c) navigate(`/${hub ? 'hub' : 'player'}/${c}`);
  };
  return (
    <div className="center-page player">
      <form
        className="card narrow"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <div className="row between">
          <h2>{t('pl_enterCode')}</h2>
          <LangToggle />
        </div>
        <input
          className="input huge-input mono"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button className="btn primary huge" disabled={!code.trim()}>
          {t('pl_continue')}
        </button>
        <button type="button" className="btn" disabled={!code.trim()} onClick={() => go(true)}>
          {t('pl_hubMode')}
        </button>
      </form>
    </div>
  );
}

const storeKey = (boardId: string, hub: boolean) => `trivia:${hub ? 'hub' : 'team'}:${boardId}`;

/** Tracks which teams this device owns, claims on pick and detects GM release. */
function useTeamClaims(boardId: string, client: ClientState, hub: boolean) {
  const key = storeKey(boardId, hub);
  const [myTeams, setMyTeams] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  });
  const [lost, setLost] = useState(false);
  const pending = useRef(new Set<string>());
  const confirmed = useRef(new Set<string>());

  const save = (ids: string[]) => {
    localStorage.setItem(key, JSON.stringify(ids));
    setMyTeams(ids);
  };

  const pick = (ids: string[]) => {
    setLost(false);
    ids.forEach((id) => {
      pending.current.add(id);
      client.send({ t: 'claim', teamId: id });
    });
    save(ids);
  };

  const leave = () => {
    myTeams.forEach((id) => client.send({ t: 'release', teamId: id }));
    pending.current.clear();
    confirmed.current.clear();
    save([]);
  };

  // reconcile against host view
  useEffect(() => {
    const live = client.live;
    if (!live || client.status !== 'online' || myTeams.length === 0) return;
    const keep: string[] = [];
    let dropped = false;
    for (const id of myTeams) {
      const team = live.teams.find((x) => x.id === id);
      if (!team || team.status === 'taken') {
        dropped = true;
        continue;
      }
      if (team.status === 'mine') {
        pending.current.delete(id);
        confirmed.current.add(id);
        keep.push(id);
      } else if (pending.current.has(id)) {
        keep.push(id);
      } else if (confirmed.current.has(id)) {
        // we owned it and the GM released it
        confirmed.current.delete(id);
        dropped = true;
      } else {
        // restored from storage but host forgot claim (e.g. new GM data) — re-claim
        pending.current.add(id);
        client.send({ t: 'claim', teamId: id });
        keep.push(id);
      }
    }
    if (dropped) {
      setLost(true);
      save(keep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.live, client.status]);

  const owned = myTeams.filter((id) => client.live?.teams.find((x) => x.id === id)?.status === 'mine');
  return { myTeams, owned, pick, leave, lost };
}

/** /player/:boardId and /hub/:boardId */
export function PlayerPage({ hub = false }: { hub?: boolean }) {
  const { boardId = '' } = useParams();
  const id = boardId.toUpperCase();
  const { t } = useI18n();
  const client = useClient(id, 'player');
  const claims = useTeamClaims(id, client, hub);
  const live = client.live;

  const header = (
    <div className="player-bar">
      <Link to="/dalibnieks" className="btn ghost small">←</Link>
      <span className="mono">{id}</span>
      <StatusDot status={client.status} />
      <div className="spacer" />
      <LangToggle />
    </div>
  );

  if (!live) {
    return (
      <div className="player">
        {header}
        <div className="center-page">
          <p className="muted">{t('board_waiting')}</p>
        </div>
      </div>
    );
  }

  if (claims.myTeams.length === 0) {
    return (
      <div className="player">
        {header}
        <TeamPicker live={live} hub={hub} lost={claims.lost} onPick={claims.pick} />
      </div>
    );
  }

  const teams = claims.myTeams.map((tid) => live.teams.find((x) => x.id === tid)).filter(Boolean) as LiveView['teams'];

  return (
    <div className="player">
      {header}
      <div className={`buzzers${hub ? ' hub' : ''}`} style={hub ? { gridTemplateColumns: `repeat(${Math.min(teams.length, 2)}, 1fr)` } : undefined}>
        {teams.map((team) => (
          <Buzzer key={team.id} live={live} teamId={team.id} teamName={team.name} owned={claims.owned.includes(team.id)} client={client} compact={hub} />
        ))}
      </div>
      <div className="player-foot">
        <button className="btn ghost small" onClick={claims.leave}>
          {t('pl_changeTeam')}
        </button>
      </div>
    </div>
  );
}

function TeamPicker({ live, hub, lost, onPick }: { live: LiveView; hub: boolean; lost: boolean; onPick: (ids: string[]) => void }) {
  const { t } = useI18n();
  const [sel, setSel] = useState<string[]>([]);
  return (
    <div className="picker">
      <h2>{hub ? t('pl_hubPick') : t('pl_chooseTeam')}</h2>
      {lost && <p className="error">{t('pl_lostTeam')}</p>}
      {live.teams.length === 0 && <p className="muted">{t('pl_noTeams')}</p>}
      <div className="team-list">
        {live.teams.map((team) => {
          const taken = team.status === 'taken';
          const selected = sel.includes(team.id);
          return (
            <button
              key={team.id}
              className={`btn huge team-btn${selected ? ' primary' : ''}`}
              disabled={taken}
              onClick={() => {
                if (!hub) onPick([team.id]);
                else setSel(selected ? sel.filter((x) => x !== team.id) : [...sel, team.id]);
              }}
            >
              {team.name}
              {taken && <small> ({t('pl_taken')})</small>}
            </button>
          );
        })}
      </div>
      {hub && (
        <button className="btn success huge" disabled={sel.length === 0} onClick={() => onPick(sel)}>
          {t('pl_hubStart')}
        </button>
      )}
    </div>
  );
}

function Buzzer({
  live,
  teamId,
  teamName,
  owned,
  client,
  compact,
}: {
  live: LiveView;
  teamId: string;
  teamName: string;
  owned: boolean;
  client: ClientState;
  compact: boolean;
}) {
  const { t } = useI18n();
  const [pressed, setPressed] = useState(false);

  // clear optimistic press whenever the host state moves on
  useEffect(() => setPressed(false), [live.buzzerOpen, live.buzzedTeam?.id, live.currentQuestionId]);

  const isMe = live.buzzedTeam?.id === teamId;
  const lockedOut = live.lockedOut.includes(teamId);
  const canBuzz = owned && live.phase === 'question' && live.buzzerOpen && !live.buzzedTeam && !lockedOut && client.status === 'online';

  let cls = 'idle';
  let label = t('pl_wait');
  if (isMe && live.correct) {
    cls = 'correct';
    label = t('pl_correct');
  } else if (isMe) {
    cls = 'first';
    label = t('pl_youFirst');
  } else if (live.phase === 'question' && live.buzzedTeam) {
    cls = 'other';
    label = t('pl_otherFirst', { name: live.buzzedTeam.name });
  } else if (live.phase === 'question' && lockedOut) {
    cls = 'other';
    label = t('pl_lockedOut');
  } else if (pressed) {
    cls = 'pressed';
    label = '…';
  } else if (canBuzz) {
    cls = 'armed';
    label = t('pl_buzz');
  } else if (live.phase === 'question') {
    label = t('pl_locked');
  }

  return (
    <button
      className={`buzzer ${cls}${compact ? ' compact' : ''}`}
      disabled={!canBuzz || pressed}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!canBuzz || pressed) return;
        if (client.send({ t: 'buzz', teamId })) {
          setPressed(true);
          navigator.vibrate?.(60);
        }
      }}
    >
      <span className="buzzer-team">{teamName}</span>
      <span className="buzzer-label">{label}</span>
    </button>
  );
}

