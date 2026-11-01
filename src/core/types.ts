export interface Question {
  id: string;
  points: number;
  question: string;
  answer: string;
  notes?: string;
  /** data URL or relative URL */
  image?: string;
}

export interface Category {
  id: string;
  name: string;
  questions: Question[];
}

export interface Logo {
  src: string;
  /** rendered height in px on the audience board */
  height: number;
}

export interface Game {
  title: string;
  categories: Category[];
  logo?: Logo;
}

export interface Team {
  id: string;
  name: string;
  score: number;
}

export type Phase = 'grid' | 'question';

export interface Live {
  phase: Phase;
  currentQuestionId: string | null;
  buzzerOpen: boolean;
  buzzedTeamId: string | null;
  /** set once the GM marks the buzzed team correct; prevents double scoring */
  correctTeamId: string | null;
  lockedOut: string[];
  revealed: boolean;
  used: string[];
  /** teamId -> deviceId */
  claims: Record<string, string>;
}

export interface GameState {
  boardId: string;
  game: Game;
  teams: Team[];
  live: Live;
}
