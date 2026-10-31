import { GameBoard } from "@/components/GameBoard";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-8 sm:py-10">
      <GameBoard />
    </main>
  );
}
