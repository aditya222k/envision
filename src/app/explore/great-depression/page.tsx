import type { Metadata } from "next";
import { ReadyGamePage } from "@/components/ReadyGamePage";

export const metadata: Metadata = {
  title: "Hard Times: 1932 | Envision",
};

export default function Page() {
  return <ReadyGamePage id="great-depression" />;
}
