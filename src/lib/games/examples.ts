export type Subject = "Science" | "Math" | "History" | "English";

// Most ideas fill in the prompt. An idea with an href opens something
// ready-made instead, with no AI generation, and says what it opens.
export type ExampleIdea = {
  title: string;
  subject: Subject;
  grade: string;
} & (
  | { prompt: string; href?: never; opens?: never }
  | { href: string; opens: string; prompt?: never }
);

export const EXAMPLE_GAMES: ExampleIdea[] = [
  {
    title: "Gravity",
    subject: "Science",
    grade: "Grade 8",
    href: "/explore/gravity",
    opens: "opens a ready-made game",
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
    title: "Great Depression",
    subject: "History",
    grade: "Grade 8",
    href: "/explore/great-depression",
    opens: "opens a ready-made game",
  },
  {
    title: "Spot the fallacy",
    subject: "English",
    grade: "High school",
    prompt:
      "A high school debate game where students read short arguments and call out the logical fallacy in each one before time runs out.",
  },
  {
    title: "Solar System",
    subject: "Science",
    grade: "Grade 8",
    href: "/explore/solar-system",
    opens: "opens a 3D explorer",
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
