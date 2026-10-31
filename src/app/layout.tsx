import type { Metadata } from "next";
import { Anton, Bricolage_Grotesque, Nunito, Shantell_Sans } from "next/font/google";
import { Suspense } from "react";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const shantell = Shantell_Sans({
  variable: "--font-shantell",
  subsets: ["latin"],
  axes: ["INFM"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Envision",
  description: "Teachers describe a game, and Envision builds it for their students.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${bricolage.variable} ${shantell.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="navbar h-[73px]" />}>
          <NavBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
