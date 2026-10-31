import type { Metadata } from "next";
import Link from "next/link";
import { SolarSystemLoader } from "@/components/SolarSystemLoader";

export const metadata: Metadata = {
  title: "Solar System | Envision",
};

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col items-start gap-4">
        <Link href="/" className="nav-button">
          Back to home
        </Link>
        <h1 className="chalk-title text-5xl sm:text-6xl">Solar System</h1>
        <p className="max-w-[56ch] text-lg leading-7 text-chalk-dim">
          Explore our cosmic neighborhood in 3D, or follow the clues to uncover
          a mystery planet and test your knowledge.
        </p>
      </div>
      <div className="pb-8">
        <SolarSystemLoader />
      </div>
    </main>
  );
}
