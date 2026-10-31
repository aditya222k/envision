export type Subject = "Science" | "Math" | "History" | "English";

export const EXAMPLE_GAMES: {
  title: string;
  subject: Subject;
  grade: string;
  prompt: string;
}[] = [
  {
    title: "Food web survival",
    subject: "Science",
    grade: "Grade 8",
    prompt:
      "A grade 8 survival game where students play an animal in a food web and choose what to eat and avoid to last through three seasons.",
  },
  {
    title: "Balance the equation",
    subject: "Science",
    grade: "High school",
    prompt:
      "A high school chemistry puzzle game where students balance equations against the clock, with hints after each wrong answer.",
  },
  {
    title: "Fraction dash",
    subject: "Math",
    grade: "Grade 8",
    prompt:
      "A grade 8 running game where students jump through the gate showing the correct answer to fraction and ratio questions.",
  },
  {
    title: "Slope skate park",
    subject: "Math",
    grade: "High school",
    prompt:
      "A high school algebra game where students build skate ramps by choosing the slope and intercept of each line.",
  },
  {
    title: "Trade route race",
    subject: "History",
    grade: "Grade 8",
    prompt:
      "A grade 8 strategy game where teams move goods along Silk Road trade routes and answer history questions to pass each city.",
  },
  {
    title: "Spot the fallacy",
    subject: "English",
    grade: "High school",
    prompt:
      "A high school debate game where students read short arguments and call out the logical fallacy in each one before time runs out.",
  },
  {
    title: "Cell city",
    subject: "Science",
    grade: "Grade 8",
    prompt:
      "A grade 8 city-building game where each part of a cell is a building, and students keep the city running by matching organelles to their jobs.",
  },
  {
    title: "Poetry heist",
    subject: "English",
    grade: "Grade 8",
    prompt:
      "A grade 8 mystery game where students crack clues hidden in poems by identifying metaphor, rhyme scheme and tone.",
  },
  {
    title: "Probability fair",
    subject: "Math",
    grade: "Grade 8",
    prompt:
      "A grade 8 carnival game where students predict the odds of each stall and earn points for choosing the fairest games.",
  },
  {
    title: "Constitution showdown",
    subject: "History",
    grade: "High school",
    prompt:
      "A high school quiz battle where two teams argue real court cases using the amendments to the Constitution.",
  },
  {
    title: "Empire builder",
    subject: "History",
    grade: "High school",
    prompt:
      "A high school turn-based game where students lead an empire and see how their choices on trade, war and religion change its history.",
  },
];
