"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { setTeachMode, useTeachMode } from "@/lib/teach-mode";

const LINKS = [
  { href: "/", label: "Build a game" },
  { href: "/games", label: "Your games" },
  { href: "/settings", label: "AI settings" },
];

export function NavBar() {
  const pathname = usePathname();
  const isTeachMode = useTeachMode();

  return (
    <header className="navbar">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <Link href="/" className="wordmark mr-auto">
          Envision
        </Link>
        <nav aria-label="Main" className="order-last w-full sm:order-none sm:w-auto">
          <ul className="flex gap-1 overflow-x-auto">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="nav-link"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          role="switch"
          aria-checked={isTeachMode}
          onClick={() => setTeachMode(!isTeachMode)}
          className="teach-switch"
        >
          <span aria-hidden="true" className="teach-switch-track">
            <span />
          </span>
          Teach mode
        </button>
      </div>
    </header>
  );
}
