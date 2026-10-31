import type { GameSpec } from "./spec";

export const SAMPLE_GAMES: GameSpec[] = [
  {
    title: "Food Web Survival",
    learningGoal: "Understand how energy moves through a food web.",
    mechanic: "journey",
    theme: "jungle",
    player: { name: "Young monkey", emoji: "🐒" },
    challenger: { name: "Hungry tiger", emoji: "🐅" },
    story: {
      intro:
        "The dry season is coming. Cross the jungle to the river by making smart choices about the food web.",
      win: "You reached the river and survived the season.",
      lose: "The jungle was too dangerous this time. Study the food web and try again.",
    },
    rounds: [
      {
        kind: "choice",
        prompt: "Which of these is a producer?",
        explanation: "Producers make their own food from sunlight, like plants do.",
        choices: ["Fig tree", "Monkey", "Tiger", "Mushroom"],
        answerIndex: 0,
      },
      {
        kind: "choice",
        prompt: "What does a herbivore eat?",
        explanation: "Herbivores get their energy by eating plants.",
        choices: ["Only meat", "Only plants", "Only insects", "Only fungi"],
        answerIndex: 1,
      },
      {
        kind: "match",
        prompt: "Match each role to its example.",
        explanation: "Each role describes how a living thing gets its energy.",
        pairs: [
          { left: "Producer", right: "Grass" },
          { left: "Consumer", right: "Deer" },
          { left: "Decomposer", right: "Fungus" },
        ],
      },
      {
        kind: "choice",
        prompt: "Where does almost all the energy in a food web start?",
        explanation: "Plants capture energy from the sun and pass it along the food web.",
        choices: ["The soil", "The sun", "Water", "Predators"],
        answerIndex: 1,
      },
      {
        kind: "choice",
        prompt: "What usually happens if all the top predators disappear?",
        explanation: "With fewer predators, prey populations can grow and overeat plants.",
        choices: [
          "Prey populations grow",
          "Plants grow faster",
          "The sun gets weaker",
          "Nothing changes",
        ],
        answerIndex: 0,
      },
    ],
  },
  {
    title: "Fraction Rocket Rescue",
    learningGoal: "Compare, add and simplify fractions.",
    mechanic: "beat-the-clock",
    theme: "space",
    player: { name: "Rocket pilot", emoji: "🧑‍🚀" },
    challenger: { name: "Space invader", emoji: "👾" },
    story: {
      intro:
        "An invader is chasing your rocket. Solve each fraction problem to keep your engines running.",
      win: "You outran the invader and reached the space station.",
      lose: "The invader caught up. Refuel and try again.",
    },
    rounds: [
      {
        kind: "choice",
        prompt: "Which fraction is greater?",
        explanation: "With the same denominator, the larger numerator is greater.",
        choices: ["3/5", "1/5", "2/5", "1/10"],
        answerIndex: 0,
      },
      {
        kind: "choice",
        prompt: "What is 1/4 + 1/4?",
        explanation: "1/4 + 1/4 is 2/4, which simplifies to 1/2.",
        choices: ["1/8", "1/2", "2/8", "1/4"],
        answerIndex: 1,
      },
      {
        kind: "choice",
        prompt: "What is 6/8 in simplest form?",
        explanation: "Dividing the top and bottom by 2 gives 3/4.",
        choices: ["2/3", "3/4", "1/2", "4/6"],
        answerIndex: 1,
      },
      {
        kind: "match",
        prompt: "Match each fraction to its decimal.",
        explanation: "Divide the numerator by the denominator to get the decimal.",
        pairs: [
          { left: "1/2", right: "0.5" },
          { left: "1/4", right: "0.25" },
          { left: "3/4", right: "0.75" },
        ],
      },
      {
        kind: "choice",
        prompt: "What is 2/3 of 12?",
        explanation: "One third of 12 is 4, so two thirds is 8.",
        choices: ["6", "8", "9", "4"],
        answerIndex: 1,
      },
    ],
  },
  {
    title: "Castle of the Constitution",
    learningGoal: "Learn the basic ideas of the US Constitution.",
    mechanic: "boss-battle",
    theme: "castle",
    player: { name: "Young citizen", emoji: "🛡️" },
    challenger: { name: "Tyrant dragon", emoji: "🐉" },
    story: {
      intro:
        "A dragon claims all the power in the land. Use your knowledge of the Constitution to stop it.",
      win: "The dragon is defeated, and power is shared again.",
      lose: "The dragon holds on to power for now. Study up and return.",
    },
    rounds: [
      {
        kind: "choice",
        prompt: "How many branches does the US government have?",
        explanation: "The three branches are legislative, executive and judicial.",
        choices: ["Two", "Three", "Four", "Five"],
        answerIndex: 1,
      },
      {
        kind: "match",
        prompt: "Match each branch to its main job.",
        explanation: "Each branch has its own power, which keeps any one from having too much.",
        pairs: [
          { left: "Legislative", right: "Makes laws" },
          { left: "Executive", right: "Carries out laws" },
          { left: "Judicial", right: "Interprets laws" },
        ],
      },
      {
        kind: "choice",
        prompt: "What are the first ten amendments called?",
        explanation: "The first ten amendments are known as the Bill of Rights.",
        choices: [
          "The Bill of Rights",
          "The Preamble",
          "The Federalist Papers",
          "The Articles",
        ],
        answerIndex: 0,
      },
      {
        kind: "choice",
        prompt: "Which amendment protects freedom of speech?",
        explanation: "The First Amendment protects speech, religion, press and assembly.",
        choices: ["First", "Second", "Fifth", "Tenth"],
        answerIndex: 0,
      },
      {
        kind: "choice",
        prompt: "What is the system that lets each branch limit the others called?",
        explanation: "Checks and balances stop any one branch from gaining too much power.",
        choices: [
          "Federalism",
          "Checks and balances",
          "Popular vote",
          "Judicial review",
        ],
        answerIndex: 1,
      },
    ],
  },
];
