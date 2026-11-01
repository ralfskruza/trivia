import type { Game, Team } from './types';

const svg = (body: string, vb = '0 0 300 200') =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`);

const FLAG_LV = svg(
  '<rect width="300" height="200" fill="#9E3039"/><rect y="80" width="300" height="40" fill="#fff"/>',
);
const PLANET = svg(
  '<rect width="300" height="200" fill="#0b1026"/>' +
    '<circle cx="40" cy="30" r="1.5" fill="#fff"/><circle cx="260" cy="40" r="1.5" fill="#fff"/><circle cx="230" cy="170" r="1.5" fill="#fff"/><circle cx="70" cy="160" r="1.5" fill="#fff"/>' +
    '<ellipse cx="150" cy="100" rx="120" ry="24" fill="none" stroke="#d9c38a" stroke-width="8" transform="rotate(-15 150 100)"/>' +
    '<circle cx="150" cy="100" r="55" fill="#e3b866"/>' +
    '<path d="M95 100 a55 55 0 0 0 110 0" fill="#c99a45"/>' +
    '<path d="M38 128 A120 24 -15 0 0 262 72" fill="none" stroke="#d9c38a" stroke-width="8"/>',
);
const HEXAGON = svg(
  '<rect width="300" height="200" fill="#f4f4f4"/>' +
    '<polygon points="150,25 215,62 215,138 150,175 85,138 85,62" fill="#3b82f6" stroke="#1e3a8a" stroke-width="6"/>',
);

export const SAMPLE_GAME: Game = {
  title: 'Erudīcijas vakars',
  categories: [
    {
      id: 'c_geo',
      name: 'Ģeogrāfija',
      questions: [
        { id: 'q_geo_1', points: 100, question: 'Kura ir Latvijas galvaspilsēta?', answer: 'Rīga', notes: 'Dibināta 1201. gadā.' },
        { id: 'q_geo_2', points: 200, question: 'Kura ir garākā upe, kas tek caur Latviju?', answer: 'Daugava', notes: 'Kopgarums ~1020 km, Latvijā ~352 km.' },
        { id: 'q_geo_3', points: 300, question: 'Kurā kontinentā atrodas Ēģipte?', answer: 'Āfrikā', notes: 'Sinaja pussala gan ir Āzijā.' },
        { id: 'q_geo_4', points: 400, question: 'Kura ir lielākā valsts pasaulē pēc platības?', answer: 'Krievija' },
        { id: 'q_geo_5', points: 500, question: 'Kurš ir lielākais ezers Latvijā pēc platības?', answer: 'Lubāns', notes: 'Platība ~80 km².' },
      ],
    },
    {
      id: 'c_sci',
      name: 'Zinātne',
      questions: [
        { id: 'q_sci_1', points: 100, question: 'Kāda ir ūdens ķīmiskā formula?', answer: 'H₂O' },
        { id: 'q_sci_2', points: 200, question: 'Kura planēta ir attēlā?', answer: 'Saturns', image: PLANET, notes: 'Attēla jautājums. Pazīstama ar saviem gredzeniem.' },
        { id: 'q_sci_3', points: 300, question: 'Cik kauli ir pieauguša cilvēka ķermenī?', answer: '206', notes: 'Pieņemt 206 ± 0.' },
        { id: 'q_sci_4', points: 400, question: 'Kurš zinātnieks formulēja relativitātes teoriju?', answer: 'Alberts Einšteins' },
        { id: 'q_sci_5', points: 500, question: 'Kāds ir gaismas ātrums vakuumā (aptuveni)?', answer: '~300 000 km/s', notes: 'Precīzi: 299 792 458 m/s.' },
      ],
    },
    {
      id: 'c_hist',
      name: 'Vēsture',
      questions: [
        { id: 'q_hist_1', points: 100, question: 'Kurā gadā Latvija pasludināja neatkarību?', answer: '1918. gadā', notes: '18. novembrī.' },
        { id: 'q_hist_2', points: 200, question: 'Kuras valsts karogs ir attēlā?', answer: 'Latvijas', image: FLAG_LV, notes: 'Attēla jautājums. Karmīnsarkans ar baltu svītru.' },
        { id: 'q_hist_3', points: 300, question: 'Kurā gadā notika Baltijas ceļš?', answer: '1989. gadā', notes: '23. augustā, ~2 miljoni dalībnieku.' },
        { id: 'q_hist_4', points: 400, question: 'Kurš bija pirmais cilvēks uz Mēness?', answer: 'Nīls Ārmstrongs', notes: '1969. gada 20. jūlijā.' },
        { id: 'q_hist_5', points: 500, question: 'Kurā gadā krita Berlīnes mūris?', answer: '1989. gadā' },
      ],
    },
    {
      id: 'c_math',
      name: 'Matemātika',
      questions: [
        { id: 'q_math_1', points: 100, question: 'Cik ir 7 × 8?', answer: '56' },
        { id: 'q_math_2', points: 200, question: 'Cik malu ir attēlā redzamajai figūrai, un kā to sauc?', answer: '6 — sešstūris', image: HEXAGON, notes: 'Attēla jautājums.' },
        { id: 'q_math_3', points: 300, question: 'Cik ir kvadrātsakne no 144?', answer: '12' },
        { id: 'q_math_4', points: 400, question: 'Kādi ir skaitļa π pirmie trīs cipari aiz komata?', answer: '3,141', notes: 'Pieņemt "141".' },
        { id: 'q_math_5', points: 500, question: 'Cik ir 2¹⁰?', answer: '1024' },
      ],
    },
    {
      id: 'c_cult',
      name: 'Kultūra',
      questions: [
        { id: 'q_cult_1', points: 100, question: 'Kādi svētki Latvijā tiek svinēti 23.–24. jūnijā?', answer: 'Līgo un Jāņi' },
        { id: 'q_cult_2', points: 200, question: 'Kurš uzrakstīja lugu "Romeo un Džuljeta"?', answer: 'Viljams Šekspīrs' },
        { id: 'q_cult_3', points: 300, question: 'Kurš ir Latvijas himnas "Dievs, svētī Latviju!" autors?', answer: 'Kārlis Baumanis', notes: 'Sarakstīta 1873. gadā.' },
        { id: 'q_cult_4', points: 400, question: 'Kurš gleznoja "Mona Lizu"?', answer: 'Leonardo da Vinči' },
        { id: 'q_cult_5', points: 500, question: 'Kurš latviešu rakstnieks uzrakstīja "Mērnieku laikus"?', answer: 'Reinis un Matīss Kaudzītes', notes: 'Brāļi Kaudzītes, 1879. gads.' },
      ],
    },
  ],
};

export const SAMPLE_TEAMS: Team[] = [
  { id: 't_a', name: 'Komanda A', score: 0 },
  { id: 't_b', name: 'Komanda B', score: 0 },
  { id: 't_c', name: 'Komanda C', score: 0 },
];

export const EMPTY_GAME: Game = { title: 'Jauna spēle', categories: [] };

export function cloneSample(): { game: Game; teams: Team[] } {
  return structuredClone({ game: SAMPLE_GAME, teams: SAMPLE_TEAMS });
}
