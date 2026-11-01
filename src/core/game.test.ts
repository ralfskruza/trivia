import { describe, expect, it } from 'vitest';
import {
  addCategory,
  addQuestion,
  createState,
  gameReducer,
  removeQuestion,
  type Action,
} from './game';
import { cloneSample } from './sample';
import type { GameState } from './types';
import { toBoardGame, toLiveView } from './views';

function setup(): GameState {
  const { game, teams } = cloneSample();
  let s = createState('ABC123', game, teams);
  s = gameReducer(s, { type: 'CLAIM', teamId: 't_a', deviceId: 'devA' });
  s = gameReducer(s, { type: 'CLAIM', teamId: 't_b', deviceId: 'devB' });
  s = gameReducer(s, { type: 'CLAIM', teamId: 't_c', deviceId: 'devC' });
  return s;
}

const run = (s: GameState, ...actions: Action[]) => actions.reduce(gameReducer, s);
const score = (s: GameState, id: string) => s.teams.find((t) => t.id === id)!.score;

// q_geo_3 is worth 300 points
const Q = 'q_geo_3';

describe('board state transitions', () => {
  it('launches a question with buzzers locked', () => {
    const s = run(setup(), { type: 'LAUNCH', questionId: Q });
    expect(s.live.phase).toBe('question');
    expect(s.live.currentQuestionId).toBe(Q);
    expect(s.live.buzzerOpen).toBe(false);
    expect(s.live.revealed).toBe(false);
  });

  it('ignores launching an unknown question', () => {
    const s0 = setup();
    expect(gameReducer(s0, { type: 'LAUNCH', questionId: 'nope' })).toBe(s0);
  });

  it('cannot open buzzers on the grid', () => {
    const s0 = setup();
    expect(gameReducer(s0, { type: 'OPEN_BUZZERS' })).toBe(s0);
  });

  it('returning to grid marks the question used and clears question state', () => {
    const s = run(
      setup(),
      { type: 'LAUNCH', questionId: Q },
      { type: 'OPEN_BUZZERS' },
      { type: 'BUZZ', teamId: 't_a', deviceId: 'devA' },
      { type: 'RETURN_TO_GRID' },
    );
    expect(s.live.phase).toBe('grid');
    expect(s.live.currentQuestionId).toBeNull();
    expect(s.live.buzzedTeamId).toBeNull();
    expect(s.live.used).toEqual([Q]);
  });

  it('TOGGLE_USED un-marks and re-marks a cell', () => {
    let s = run(setup(), { type: 'LAUNCH', questionId: Q }, { type: 'RETURN_TO_GRID' });
    s = gameReducer(s, { type: 'TOGGLE_USED', questionId: Q });
    expect(s.live.used).toEqual([]);
    s = gameReducer(s, { type: 'TOGGLE_USED', questionId: Q });
    expect(s.live.used).toEqual([Q]);
  });

  it('reveal shows the answer and closes buzzers', () => {
    const s = run(setup(), { type: 'LAUNCH', questionId: Q }, { type: 'OPEN_BUZZERS' }, { type: 'REVEAL' });
    expect(s.live.revealed).toBe(true);
    expect(s.live.buzzerOpen).toBe(false);
    expect(toLiveView(s, null).answer).toBe('Āfrikā');
  });

  it('deleting the active question returns to grid', () => {
    let s = run(setup(), { type: 'LAUNCH', questionId: Q });
    s = gameReducer(s, { type: 'SET_GAME', game: removeQuestion(s.game, Q) });
    expect(s.live.phase).toBe('grid');
    expect(s.live.currentQuestionId).toBeNull();
  });
});

describe('buzzer arbitration', () => {
  it('ignores buzzes before the GM opens buzzers', () => {
    const s = run(setup(), { type: 'LAUNCH', questionId: Q }, { type: 'BUZZ', teamId: 't_a', deviceId: 'devA' });
    expect(s.live.buzzedTeamId).toBeNull();
  });

  it('accepts only the first buzz', () => {
    const s = run(
      setup(),
      { type: 'LAUNCH', questionId: Q },
      { type: 'OPEN_BUZZERS' },
      { type: 'BUZZ', teamId: 't_b', deviceId: 'devB' },
      { type: 'BUZZ', teamId: 't_a', deviceId: 'devA' },
      { type: 'BUZZ', teamId: 't_c', deviceId: 'devC' },
    );
    expect(s.live.buzzedTeamId).toBe('t_b');
    expect(s.live.buzzerOpen).toBe(false);
  });

  it('rejects buzzes from a device that does not own the team', () => {
    const s = run(
      setup(),
      { type: 'LAUNCH', questionId: Q },
      { type: 'OPEN_BUZZERS' },
      { type: 'BUZZ', teamId: 't_a', deviceId: 'devB' },
    );
    expect(s.live.buzzedTeamId).toBeNull();
  });

  it('rejects buzzes from unknown teams', () => {
    const s = run(setup(), { type: 'LAUNCH', questionId: Q }, { type: 'OPEN_BUZZERS' }, { type: 'BUZZ', teamId: 'x' });
    expect(s.live.buzzedTeamId).toBeNull();
  });

  it('locks out a team after an incorrect answer and reopens for the rest', () => {
    const s = run(
      setup(),
      { type: 'LAUNCH', questionId: Q },
      { type: 'OPEN_BUZZERS' },
      { type: 'BUZZ', teamId: 't_a', deviceId: 'devA' },
      { type: 'INCORRECT' },
      { type: 'BUZZ', teamId: 't_a', deviceId: 'devA' },
    );
    expect(s.live.lockedOut).toEqual(['t_a']);
    expect(s.live.buzzerOpen).toBe(true);
    expect(s.live.buzzedTeamId).toBeNull();
    const s2 = gameReducer(s, { type: 'BUZZ', teamId: 't_c', deviceId: 'devC' });
    expect(s2.live.buzzedTeamId).toBe('t_c');
  });

  it('keeps buzzers closed when every team is locked out', () => {
    let s = run(setup(), { type: 'LAUNCH', questionId: Q }, { type: 'OPEN_BUZZERS' });
    for (const [t, d] of [['t_a', 'devA'], ['t_b', 'devB'], ['t_c', 'devC']]) {
      s = run(s, { type: 'BUZZ', teamId: t, deviceId: d }, { type: 'INCORRECT' });
    }
    expect(s.live.lockedOut).toHaveLength(3);
    expect(s.live.buzzerOpen).toBe(false);
  });

  it('reset clears buzz and lockouts and reopens buzzers', () => {
    const s = run(
      setup(),
      { type: 'LAUNCH', questionId: Q },
      { type: 'OPEN_BUZZERS' },
      { type: 'BUZZ', teamId: 't_a', deviceId: 'devA' },
      { type: 'INCORRECT' },
      { type: 'BUZZ', teamId: 't_b', deviceId: 'devB' },
      { type: 'RESET_BUZZER' },
    );
    expect(s.live.buzzedTeamId).toBeNull();
    expect(s.live.lockedOut).toEqual([]);
    expect(s.live.buzzerOpen).toBe(true);
    expect(score(s, 't_a')).toBe(-300); // reset does not undo penalties
  });

  it('team claims are exclusive until released', () => {
    let s = setup();
    s = gameReducer(s, { type: 'CLAIM', teamId: 't_a', deviceId: 'intruder' });
    expect(s.live.claims.t_a).toBe('devA');
    s = gameReducer(s, { type: 'RELEASE', teamId: 't_a' });
    s = gameReducer(s, { type: 'CLAIM', teamId: 't_a', deviceId: 'intruder' });
    expect(s.live.claims.t_a).toBe('intruder');
  });
});

describe('scoring', () => {
  it('correct adds points, closes buzzers and reveals', () => {
    const s = run(
      setup(),
      { type: 'LAUNCH', questionId: Q },
      { type: 'OPEN_BUZZERS' },
      { type: 'BUZZ', teamId: 't_a', deviceId: 'devA' },
      { type: 'CORRECT' },
    );
    expect(score(s, 't_a')).toBe(300);
    expect(score(s, 't_b')).toBe(0);
    expect(s.live.revealed).toBe(true);
    expect(s.live.buzzerOpen).toBe(false);
  });

  it('incorrect subtracts points from the buzzing team only', () => {
    const s = run(
      setup(),
      { type: 'LAUNCH', questionId: Q },
      { type: 'OPEN_BUZZERS' },
      { type: 'BUZZ', teamId: 't_b', deviceId: 'devB' },
      { type: 'INCORRECT' },
    );
    expect(score(s, 't_b')).toBe(-300);
    expect(score(s, 't_a')).toBe(0);
  });

  it('correct/incorrect without a buzz do nothing', () => {
    const s0 = run(setup(), { type: 'LAUNCH', questionId: Q }, { type: 'OPEN_BUZZERS' });
    expect(gameReducer(s0, { type: 'CORRECT' })).toBe(s0);
    expect(gameReducer(s0, { type: 'INCORRECT' })).toBe(s0);
  });

  it('cannot double-score by pressing correct twice', () => {
    const s = run(
      setup(),
      { type: 'LAUNCH', questionId: Q },
      { type: 'OPEN_BUZZERS' },
      { type: 'BUZZ', teamId: 't_a', deviceId: 'devA' },
      { type: 'CORRECT' },
      { type: 'CORRECT' },
    );
    // the second CORRECT is ignored because correctTeamId is already set
    expect(score(s, 't_a')).toBe(300);
  });

  it('full round: wrong then right', () => {
    const s = run(
      setup(),
      { type: 'LAUNCH', questionId: 'q_sci_5' }, // 500
      { type: 'OPEN_BUZZERS' },
      { type: 'BUZZ', teamId: 't_a', deviceId: 'devA' },
      { type: 'INCORRECT' },
      { type: 'BUZZ', teamId: 't_b', deviceId: 'devB' },
      { type: 'CORRECT' },
      { type: 'RETURN_TO_GRID' },
    );
    expect(score(s, 't_a')).toBe(-500);
    expect(score(s, 't_b')).toBe(500);
    expect(score(s, 't_c')).toBe(0);
    expect(s.live.used).toContain('q_sci_5');
  });

  it('manual adjustments and reset', () => {
    let s = run(setup(), { type: 'ADJUST_SCORE', teamId: 't_c', delta: 100 }, { type: 'ADJUST_SCORE', teamId: 't_c', delta: -50 });
    expect(score(s, 't_c')).toBe(50);
    s = gameReducer(s, { type: 'RESET_SCORES' });
    expect(s.teams.every((t) => t.score === 0)).toBe(true);
  });
});

describe('views and editing', () => {
  it('board game never contains answers or notes', () => {
    const json = JSON.stringify(toBoardGame(setup()));
    expect(json).not.toContain('Āfrikā');
    expect(json).not.toContain('Sinaja');
  });

  it('live view hides the answer until revealed and reports team ownership', () => {
    const s = run(setup(), { type: 'LAUNCH', questionId: Q });
    const v = toLiveView(s, 'devA');
    expect(v.answer).toBeNull();
    expect(v.teams.find((t) => t.id === 't_a')!.status).toBe('mine');
    expect(v.teams.find((t) => t.id === 't_b')!.status).toBe('taken');
  });

  it('adds categories and questions with sensible point values', () => {
    let g = addCategory(cloneSample().game, 'Jauna');
    const cat = g.categories[g.categories.length - 1];
    expect(cat.questions.map((q) => q.points)).toEqual([100, 200, 300, 400, 500]);
    g = addQuestion(g, cat.id);
    expect(g.categories[g.categories.length - 1].questions.at(-1)!.points).toBe(600);
  });
});
