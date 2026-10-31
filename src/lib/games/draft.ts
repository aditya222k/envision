export type GameDraft = {
  title?: string;
  mechanic?: string;
  theme?: string;
  player?: { name?: string; emoji?: string };
  challenger?: { name?: string; emoji?: string };
  intro?: string;
  questions: string[];
};

function readString(text: string, key: string) {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`));
  if (!match) {
    return undefined;
  }
  try {
    return JSON.parse(match[1]) as string;
  } catch {
    return undefined;
  }
}

function section(text: string, start: string, end: string) {
  const from = text.indexOf(`"${start}"`);
  if (from < 0) {
    return "";
  }
  const to = text.indexOf(`"${end}"`, from);
  return to < 0 ? text.slice(from) : text.slice(from, to);
}

// Reads whichever fields the model has finished writing so far. Only complete
// strings match, so half-written text never reaches the page.
export function readDraft(text: string): GameDraft {
  const player = section(text, "player", "challenger");
  const challenger = section(text, "challenger", "story");
  const story = section(text, "story", "rounds");
  const rounds = text.slice(Math.max(text.indexOf('"rounds"'), 0));

  return {
    title: readString(text, "title"),
    mechanic: readString(text, "mechanic"),
    theme: readString(text, "theme"),
    player: { name: readString(player, "name"), emoji: readString(player, "emoji") },
    challenger: {
      name: readString(challenger, "name"),
      emoji: readString(challenger, "emoji"),
    },
    intro: readString(story, "intro"),
    questions: text.includes('"rounds"')
      ? [...rounds.matchAll(/"prompt"\s*:\s*("(?:[^"\\]|\\.)*")/g)].flatMap(
          (match) => {
            try {
              return [JSON.parse(match[1]) as string];
            } catch {
              return [];
            }
          },
        )
      : [],
  };
}
