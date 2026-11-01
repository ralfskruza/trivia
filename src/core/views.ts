import { currentQuestion } from './game';
import type { GameState, Logo, Phase } from './types';

/** Game content sent to the audience board: no answers, no host notes. */
export interface BoardGame {
  title: string;
  logo?: Logo;
  categories: {
    id: string;
    name: string;
    questions: { id: string; points: number; question: string; image?: string }[];
  }[];
}

export type TeamStatus = 'free' | 'mine' | 'taken';

export interface LiveView {
  phase: Phase;
  currentQuestionId: string | null;
  buzzerOpen: boolean;
  buzzedTeam: { id: string; name: string } | null;
  /** true once the buzzed team was marked correct */
  correct: boolean;
  lockedOut: string[];
  revealed: boolean;
  /** only populated once revealed */
  answer: string | null;
  used: string[];
  teams: { id: string; name: string; status: TeamStatus }[];
}

export function toBoardGame(state: GameState): BoardGame {
  return {
    title: state.game.title,
    logo: state.game.logo,
    categories: state.game.categories.map((c) => ({
      id: c.id,
      name: c.name,
      questions: c.questions.map((q) => ({ id: q.id, points: q.points, question: q.question, image: q.image })),
    })),
  };
}

export function toLiveView(state: GameState, deviceId: string | null): LiveView {
  const { live } = state;
  const cq = currentQuestion(state);
  const buzzed = live.buzzedTeamId ? state.teams.find((t) => t.id === live.buzzedTeamId) : undefined;
  return {
    phase: live.phase,
    currentQuestionId: live.currentQuestionId,
    buzzerOpen: live.buzzerOpen,
    buzzedTeam: buzzed ? { id: buzzed.id, name: buzzed.name } : null,
    correct: !!live.correctTeamId,
    lockedOut: live.lockedOut,
    revealed: live.revealed,
    answer: live.revealed && cq ? cq.question.answer : null,
    used: live.used,
    teams: state.teams.map((t) => {
      const owner = live.claims[t.id];
      const status: TeamStatus = !owner ? 'free' : owner === deviceId ? 'mine' : 'taken';
      return { id: t.id, name: t.name, status };
    }),
  };
}
