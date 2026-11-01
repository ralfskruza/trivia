import type { Category, Game, GameState, Live, Question, Team } from './types';

export type Action =
  | { type: 'LAUNCH'; questionId: string }
  | { type: 'OPEN_BUZZERS' }
  | { type: 'BUZZ'; teamId: string; deviceId?: string }
  | { type: 'CORRECT' }
  | { type: 'INCORRECT' }
  | { type: 'RESET_BUZZER' }
  | { type: 'REVEAL' }
  | { type: 'RETURN_TO_GRID' }
  | { type: 'TOGGLE_USED'; questionId: string }
  | { type: 'RESET_USED' }
  | { type: 'ADJUST_SCORE'; teamId: string; delta: number }
  | { type: 'RESET_SCORES' }
  | { type: 'ADD_TEAM'; team: Team }
  | { type: 'RENAME_TEAM'; teamId: string; name: string }
  | { type: 'REMOVE_TEAM'; teamId: string }
  | { type: 'CLAIM'; teamId: string; deviceId: string }
  | { type: 'RELEASE'; teamId: string }
  | { type: 'SET_GAME'; game: Game }
  | { type: 'REPLACE'; state: GameState };

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const BOARD_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateBoardId(length = 6): string {
  let s = '';
  for (let i = 0; i < length; i++) s += BOARD_ID_ALPHABET[Math.floor(Math.random() * BOARD_ID_ALPHABET.length)];
  return s;
}

export function initialLive(): Live {
  return {
    phase: 'grid',
    currentQuestionId: null,
    buzzerOpen: false,
    buzzedTeamId: null,
    correctTeamId: null,
    lockedOut: [],
    revealed: false,
    used: [],
    claims: {},
  };
}

export function createState(boardId: string, game: Game, teams: Team[] = []): GameState {
  return { boardId, game, teams, live: initialLive() };
}

export function findQuestion(game: Game, questionId: string | null): { category: Category; question: Question } | null {
  if (!questionId) return null;
  for (const category of game.categories) {
    const question = category.questions.find((q) => q.id === questionId);
    if (question) return { category, question };
  }
  return null;
}

export function currentQuestion(state: GameState) {
  return findQuestion(state.game, state.live.currentQuestionId);
}

/** Teams that may still buzz for the current question. */
export function eligibleTeams(state: GameState): Team[] {
  return state.teams.filter((t) => !state.live.lockedOut.includes(t.id));
}

function clearQuestion(live: Live): Live {
  return {
    ...live,
    phase: 'grid',
    currentQuestionId: null,
    buzzerOpen: false,
    buzzedTeamId: null,
    correctTeamId: null,
    lockedOut: [],
    revealed: false,
  };
}

function setScore(teams: Team[], teamId: string, delta: number): Team[] {
  return teams.map((t) => (t.id === teamId ? { ...t, score: t.score + delta } : t));
}

export function gameReducer(state: GameState, action: Action): GameState {
  const { live } = state;
  switch (action.type) {
    case 'LAUNCH': {
      if (!findQuestion(state.game, action.questionId)) return state;
      return {
        ...state,
        live: {
          ...live,
          phase: 'question',
          currentQuestionId: action.questionId,
          buzzerOpen: false,
          buzzedTeamId: null,
          correctTeamId: null,
          lockedOut: [],
          revealed: false,
        },
      };
    }
    case 'OPEN_BUZZERS': {
      if (live.phase !== 'question' || live.buzzedTeamId || live.revealed) return state;
      return { ...state, live: { ...live, buzzerOpen: true } };
    }
    case 'BUZZ': {
      // First-to-buzz arbitration: only the first valid buzz while open is accepted.
      if (live.phase !== 'question' || !live.buzzerOpen || live.buzzedTeamId) return state;
      if (!state.teams.some((t) => t.id === action.teamId)) return state;
      if (live.lockedOut.includes(action.teamId)) return state;
      if (action.deviceId !== undefined && live.claims[action.teamId] !== action.deviceId) return state;
      return { ...state, live: { ...live, buzzedTeamId: action.teamId, buzzerOpen: false } };
    }
    case 'CORRECT': {
      const cq = currentQuestion(state);
      if (live.phase !== 'question' || !live.buzzedTeamId || live.correctTeamId || !cq) return state;
      return {
        ...state,
        teams: setScore(state.teams, live.buzzedTeamId, cq.question.points),
        live: { ...live, buzzerOpen: false, revealed: true, correctTeamId: live.buzzedTeamId },
      };
    }
    case 'INCORRECT': {
      const cq = currentQuestion(state);
      if (live.phase !== 'question' || !live.buzzedTeamId || live.correctTeamId || !cq) return state;
      const lockedOut = [...live.lockedOut, live.buzzedTeamId];
      const anyLeft = state.teams.some((t) => !lockedOut.includes(t.id));
      return {
        ...state,
        teams: setScore(state.teams, live.buzzedTeamId, -cq.question.points),
        live: { ...live, buzzedTeamId: null, lockedOut, buzzerOpen: anyLeft && !live.revealed },
      };
    }
    case 'RESET_BUZZER': {
      if (live.phase !== 'question' || live.correctTeamId) return state;
      return {
        ...state,
        live: { ...live, buzzedTeamId: null, lockedOut: [], buzzerOpen: !live.revealed },
      };
    }
    case 'REVEAL': {
      if (live.phase !== 'question') return state;
      return { ...state, live: { ...live, revealed: true, buzzerOpen: false } };
    }
    case 'RETURN_TO_GRID': {
      if (live.phase !== 'question') return state;
      const id = live.currentQuestionId;
      const used = id && !live.used.includes(id) ? [...live.used, id] : live.used;
      return { ...state, live: { ...clearQuestion(live), used } };
    }
    case 'TOGGLE_USED': {
      const used = live.used.includes(action.questionId)
        ? live.used.filter((id) => id !== action.questionId)
        : [...live.used, action.questionId];
      return { ...state, live: { ...live, used } };
    }
    case 'RESET_USED':
      return { ...state, live: { ...live, used: [] } };
    case 'ADJUST_SCORE':
      return { ...state, teams: setScore(state.teams, action.teamId, action.delta) };
    case 'RESET_SCORES':
      return { ...state, teams: state.teams.map((t) => ({ ...t, score: 0 })) };
    case 'ADD_TEAM':
      if (state.teams.some((t) => t.id === action.team.id)) return state;
      return { ...state, teams: [...state.teams, action.team] };
    case 'RENAME_TEAM':
      return {
        ...state,
        teams: state.teams.map((t) => (t.id === action.teamId ? { ...t, name: action.name } : t)),
      };
    case 'REMOVE_TEAM': {
      const claims = { ...live.claims };
      delete claims[action.teamId];
      return {
        ...state,
        teams: state.teams.filter((t) => t.id !== action.teamId),
        live: {
          ...live,
          claims,
          lockedOut: live.lockedOut.filter((id) => id !== action.teamId),
          buzzedTeamId: live.buzzedTeamId === action.teamId ? null : live.buzzedTeamId,
        },
      };
    }
    case 'CLAIM': {
      if (!state.teams.some((t) => t.id === action.teamId)) return state;
      const owner = live.claims[action.teamId];
      if (owner && owner !== action.deviceId) return state;
      if (owner === action.deviceId) return state;
      return { ...state, live: { ...live, claims: { ...live.claims, [action.teamId]: action.deviceId } } };
    }
    case 'RELEASE': {
      if (!(action.teamId in live.claims)) return state;
      const claims = { ...live.claims };
      delete claims[action.teamId];
      return { ...state, live: { ...live, claims } };
    }
    case 'SET_GAME': {
      const next = { ...state, game: action.game };
      const ids = new Set(action.game.categories.flatMap((c) => c.questions.map((q) => q.id)));
      let nextLive = { ...live, used: live.used.filter((id) => ids.has(id)) };
      if (live.currentQuestionId && !ids.has(live.currentQuestionId)) nextLive = clearQuestion(nextLive);
      return { ...next, live: nextLive };
    }
    case 'REPLACE':
      return action.state;
    default:
      return state;
  }
}

// ---------- Pure game editing helpers ----------

export function addCategory(game: Game, name: string): Game {
  const rows = Math.max(0, ...game.categories.map((c) => c.questions.length));
  const questions: Question[] = Array.from({ length: rows }, (_, i) => ({
    id: uid('q_'),
    points: (i + 1) * 100,
    question: '',
    answer: '',
  }));
  return { ...game, categories: [...game.categories, { id: uid('c_'), name, questions }] };
}

export function updateCategory(game: Game, categoryId: string, patch: Partial<Omit<Category, 'id'>>): Game {
  return { ...game, categories: game.categories.map((c) => (c.id === categoryId ? { ...c, ...patch } : c)) };
}

export function removeCategory(game: Game, categoryId: string): Game {
  return { ...game, categories: game.categories.filter((c) => c.id !== categoryId) };
}

export function moveCategory(game: Game, categoryId: string, dir: -1 | 1): Game {
  const idx = game.categories.findIndex((c) => c.id === categoryId);
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= game.categories.length) return game;
  const categories = [...game.categories];
  [categories[idx], categories[to]] = [categories[to], categories[idx]];
  return { ...game, categories };
}

export function addQuestion(game: Game, categoryId: string): Game {
  return {
    ...game,
    categories: game.categories.map((c) => {
      if (c.id !== categoryId) return c;
      const maxPts = Math.max(0, ...c.questions.map((q) => q.points));
      return {
        ...c,
        questions: [...c.questions, { id: uid('q_'), points: maxPts + 100, question: '', answer: '' }],
      };
    }),
  };
}

export function updateQuestion(game: Game, questionId: string, patch: Partial<Omit<Question, 'id'>>): Game {
  return {
    ...game,
    categories: game.categories.map((c) => ({
      ...c,
      questions: c.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
    })),
  };
}

export function removeQuestion(game: Game, questionId: string): Game {
  return {
    ...game,
    categories: game.categories.map((c) => ({ ...c, questions: c.questions.filter((q) => q.id !== questionId) })),
  };
}

export function validateState(data: unknown): data is GameState {
  if (!data || typeof data !== 'object') return false;
  const s = data as GameState;
  return (
    typeof s.boardId === 'string' &&
    !!s.game &&
    Array.isArray(s.game.categories) &&
    Array.isArray(s.teams) &&
    !!s.live &&
    Array.isArray(s.live.used)
  );
}

export function validateGame(data: unknown): data is Game {
  if (!data || typeof data !== 'object') return false;
  const g = data as Game;
  return (
    typeof g.title === 'string' &&
    Array.isArray(g.categories) &&
    g.categories.every(
      (c) =>
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        Array.isArray(c.questions) &&
        c.questions.every((q) => typeof q.id === 'string' && typeof q.points === 'number'),
    )
  );
}
