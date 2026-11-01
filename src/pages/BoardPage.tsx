import { useParams } from 'react-router-dom';
import { BoardHeader } from '../components/BoardHeader';
import { Grid } from '../components/Grid';
import { StatusDot } from '../components/ui';
import type { BoardGame, LiveView } from '../core/views';
import { useI18n } from '../i18n';
import { useClient } from '../net/client';

export default function BoardPage() {
  const { boardId = '' } = useParams();
  const id = boardId.toUpperCase();
  const { t } = useI18n();
  const { status, game, live } = useClient(id, 'board');

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (!game || !live) {
    return (
      <div className="board center-page">
        <div className="board-waiting">
          <h1>{t('board_waiting')}</h1>
          <p className="board-code-big">
            {t('board_code')}: <b>{id}</b>
          </p>
          <StatusDot status={status} />
        </div>
      </div>
    );
  }

  return (
    <div className="board">
      <BoardHeader title={game.title} logo={game.logo} />
      <Grid variant="board" categories={game.categories} used={live.used} />
      <div className="board-corner">
        {status !== 'online' && <StatusDot status={status} />}
        <button className="btn ghost small fs-btn" onClick={toggleFullscreen} title={t('board_fullscreen')}>
          ⛶
        </button>
      </div>
      {live.phase === 'question' && <QuestionOverlay key={live.currentQuestionId} game={game} live={live} />}
    </div>
  );
}

function QuestionOverlay({ game, live }: { game: BoardGame; live: LiveView }) {
  const { t } = useI18n();
  let category: BoardGame['categories'][number] | undefined;
  let question: BoardGame['categories'][number]['questions'][number] | undefined;
  for (const c of game.categories) {
    const q = c.questions.find((x) => x.id === live.currentQuestionId);
    if (q) {
      category = c;
      question = q;
      break;
    }
  }
  if (!category || !question) return null;

  const hidden = !!live.buzzedTeam && !live.revealed;

  return (
    <div className="overlay">
      <div className="overlay-meta">
        <span>{category.name}</span>
        <span className="gold">{question.points}</span>
      </div>
      {hidden ? (
        <div className="overlay-buzz" key={live.buzzedTeam!.id}>
          <div className="bell">🔔</div>
          <div className="buzz-name">{live.buzzedTeam!.name}</div>
        </div>
      ) : (
        <div className={`overlay-content${live.revealed ? ' revealed' : ''}`}>
          <p className="overlay-q">{question.question}</p>
          {question.image && !live.revealed && <img className="overlay-img" src={question.image} alt="" />}
          {live.revealed && (
            <div className="overlay-answer">
              <span className="label">{t('board_answer')}</span>
              <span className="answer-text">{live.answer}</span>
              {live.correct && live.buzzedTeam && (
                <span className="answer-team">
                  ✓ {live.buzzedTeam.name} — {t('board_correct')}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

