import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Shantell_Sans } from "next/font/google";
import { Suspense } from "react";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const shantell = Shantell_Sans({
  variable: "--font-shantell",
  subsets: ["latin"],
  axes: ["INFM"],
});

export const metadata: Metadata = {
  title: "Envision",
  description: "Teachers describe a game, and Envision builds it for their students.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${atkinson.variable} ${shantell.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="navbar h-[68px]" />}>
          <NavBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
