import type { Metadata } from "next";
import { ReadyGamePage } from "@/components/ReadyGamePage";

export const metadata: Metadata = {
  title: "Gravity Playground | Envision",
};

export default function Page() {
  return <ReadyGamePage id="gravity" />;
}
