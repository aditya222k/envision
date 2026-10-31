// Prepared classroom questions. No model calls or external assets during play.
export type PlanetQuestion = {
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
};

export const PLANET_QUIZ: Record<string, { clues: string[]; questions: PlanetQuestion[] }> = {
  mercury: {
    clues: ["I am a small, rocky world with almost no atmosphere.", "My surface is covered with craters.", "I am the closest planet to the Sun."],
    questions: [
      { prompt: "Why does Mercury have very large temperature changes?", choices: ["Its rings block sunlight", "It has almost no atmosphere to retain heat", "It is made of ice"], answer: 1, explanation: "Mercury has almost no atmosphere to retain and redistribute heat." },
      { prompt: "How long is one Mercury year?", choices: ["88 Earth days", "365 Earth days", "12 Earth years"], answer: 0, explanation: "Mercury completes an orbit of the Sun in about 88 Earth days." },
    ],
  },
  venus: {
    clues: ["I am a rocky planet wrapped in thick clouds.", "I am the hottest planet, even though I am not closest to the Sun.", "I am the second planet from the Sun."],
    questions: [
      { prompt: "What keeps Venus so hot?", choices: ["A thick atmosphere that traps heat", "Its many moons", "Its icy rings"], answer: 0, explanation: "Venus's thick, carbon dioxide-rich atmosphere produces an extreme greenhouse effect." },
      { prompt: "Which planet orbits just inside Venus's orbit?", choices: ["Mars", "Earth", "Mercury"], answer: 2, explanation: "The order from the Sun starts Mercury, Venus, then Earth." },
    ],
  },
  earth: {
    clues: ["I am a rocky planet with abundant liquid water at the surface.", "I am the only planet known to support life.", "I am the third planet from the Sun, and your home."],
    questions: [
      { prompt: "About how much of Earth's surface is covered by water?", choices: ["10%", "71%", "100%"], answer: 1, explanation: "Water covers about 71% of Earth's surface." },
      { prompt: "What does one Earth year measure?", choices: ["One rotation on its axis", "One trip of the Moon around Earth", "One orbit around the Sun"], answer: 2, explanation: "An Earth year is one orbit around the Sun, taking about 365 days." },
    ],
  },
  mars: {
    clues: ["I am a cold, rocky desert planet.", "Rust in my soil gives me a reddish appearance.", "I am the fourth planet from the Sun and home to Olympus Mons."],
    questions: [
      { prompt: "What gives Mars its reddish appearance?", choices: ["Iron oxide, or rust", "Red oceans", "A red-colored Sun"], answer: 0, explanation: "Iron minerals in Mars's surface have oxidized, giving the dust a rusty color." },
      { prompt: "What is Olympus Mons?", choices: ["A ring", "A volcano", "A moon"], answer: 1, explanation: "Olympus Mons is a giant volcano on Mars." },
    ],
  },
  jupiter: {
    clues: ["I am a gas giant with bands of clouds.", "I am the largest planet in our solar system.", "My Great Red Spot is a huge storm. I am fifth from the Sun."],
    questions: [
      { prompt: "What is Jupiter's Great Red Spot?", choices: ["A volcano", "An ocean", "A giant storm"], answer: 2, explanation: "The Great Red Spot is a long-lived storm in Jupiter's atmosphere." },
      { prompt: "Which description fits Jupiter?", choices: ["A gas giant", "A small rocky planet", "A star"], answer: 0, explanation: "Jupiter is a gas giant composed mainly of hydrogen and helium." },
    ],
  },
  saturn: {
    clues: ["I am a gas giant with a pale, banded atmosphere.", "I have the most prominent ring system of the planets.", "My rings contain ice and rock. I am sixth from the Sun."],
    questions: [
      { prompt: "What are Saturn's rings made of?", choices: ["One solid metal disc", "Many pieces of ice and rock", "Only clouds"], answer: 1, explanation: "Saturn's rings contain countless particles, mainly ice with rock and dust." },
      { prompt: "Which planet is immediately closer to the Sun than Saturn?", choices: ["Neptune", "Uranus", "Jupiter"], answer: 2, explanation: "Jupiter is fifth from the Sun; Saturn is sixth." },
    ],
  },
  uranus: {
    clues: ["I am an ice giant with a blue-green atmosphere.", "I rotate tipped almost onto my side.", "I am the seventh planet from the Sun."],
    questions: [
      { prompt: "What is unusual about Uranus's rotation?", choices: ["It never rotates", "Its axis is tilted almost onto its side", "It rotates around Earth"], answer: 1, explanation: "Uranus's axis is tilted about 98 degrees, so it rotates almost on its side." },
      { prompt: "Which gas contributes to Uranus's blue-green appearance?", choices: ["Methane", "Oxygen", "Carbon dioxide"], answer: 0, explanation: "Methane absorbs red light, contributing to the planet's blue-green appearance." },
    ],
  },
  neptune: {
    clues: ["I am a cold ice giant with a blue atmosphere.", "My atmosphere has extremely fast winds.", "I am the eighth and farthest planet from the Sun."],
    questions: [
      { prompt: "About how long does Neptune take to orbit the Sun?", choices: ["One Earth year", "12 Earth years", "165 Earth years"], answer: 2, explanation: "Neptune's distant orbit takes about 165 Earth years to complete." },
      { prompt: "Which planet is immediately closer to the Sun than Neptune?", choices: ["Uranus", "Earth", "Venus"], answer: 0, explanation: "Uranus is seventh from the Sun; Neptune is eighth." },
    ],
  },
};

export type QuizState = {
  order: string[];
  round: number;
  phase: "guess" | "reveal" | "question" | "complete";
  clues: number;
  feedback: string;
  identified: boolean;
  question: number;
  selected: number | null;
  score: number;
  planetsGuessed: number;
  answersCorrect: number;
};

export type QuizAction =
  | { type: "guess"; value: string }
  | { type: "hint" }
  | { type: "reveal" }
  | { type: "answer"; choice: number }
  | { type: "continue" }
  | { type: "restart"; order: string[] };

export function shuffledPlanetIds() {
  const ids = Object.keys(PLANET_QUIZ);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function initialQuiz(order: string[]): QuizState {
  return { order, round: 0, phase: "guess", clues: 1, feedback: "", identified: false, question: 0, selected: null, score: 0, planetsGuessed: 0, answersCorrect: 0 };
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  if (action.type === "restart") return initialQuiz(action.order);
  if (state.phase === "complete") return state;
  const id = state.order[state.round];
  const activity = PLANET_QUIZ[id];
  if (action.type === "guess" && state.phase === "guess") {
    const guess = action.value.trim().toLowerCase().replace(/^planet\s+/, "");
    if (!guess) return { ...state, feedback: "Type a planet name first." };
    if (guess !== id) return { ...state, feedback: "Not quite. Try again, or ask for another clue." };
    return { ...state, phase: "reveal", identified: true, feedback: "", planetsGuessed: state.planetsGuessed + 1, score: state.score + 10 - (state.clues - 1) * 2 };
  }
  if (action.type === "hint" && state.phase === "guess") {
    return { ...state, clues: Math.min(state.clues + 1, activity.clues.length), feedback: "" };
  }
  if (action.type === "reveal" && state.phase === "guess") {
    return { ...state, phase: "reveal", feedback: "" };
  }
  if (action.type === "answer" && state.phase === "question" && state.selected === null) {
    const question = activity.questions[state.question];
    if (!Number.isInteger(action.choice) || action.choice < 0 || action.choice >= question.choices.length) return state;
    const correct = action.choice === question.answer;
    return { ...state, selected: action.choice, score: state.score + (correct ? 5 : 0), answersCorrect: state.answersCorrect + Number(correct) };
  }
  if (action.type === "continue") {
    if (state.phase === "reveal") return { ...state, phase: "question" };
    if (state.phase !== "question" || state.selected === null) return state;
    if (state.question + 1 < activity.questions.length) return { ...state, question: state.question + 1, selected: null };
    if (state.round + 1 === state.order.length) return { ...state, phase: "complete" };
    return { ...state, round: state.round + 1, phase: "guess", clues: 1, feedback: "", identified: false, question: 0, selected: null };
  }
  return state;
}
