"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { setIncognito, useIncognito } from "@/lib/incognito";

const LINKS = [
  { href: "/", label: "Build a game" },
  { href: "/storylines", label: "Storylines" },
  { href: "/games", label: "Your games" },
  { href: "/settings", label: "AI settings" },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavBar() {
  const pathname = usePathname();
  const isIncognito = useIncognito();

  // Students follow a course link and shouldn't see the teacher's tools.
  if (pathname.startsWith("/path/")) {
    return null;
  }

  return (
    <header className="navbar">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-10">
        <Link href="/" aria-label="Envision home" className="wordmark">
          {/* "envision" with a purple and a yellow dot on its two i's */}
          <span aria-hidden="true">
            env
            <span className="wordmark-i">
              ı
              <span className="wordmark-dot bg-pencil" />
            </span>
            s
            <span className="wordmark-i">
              ı
              <span className="wordmark-dot bg-sun" />
            </span>
            on
          </span>
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <ul className="flex flex-wrap gap-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={
                    isCurrent(pathname, link.href) ? "page" : undefined
                  }
                  className="nav-link"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            role="switch"
            aria-checked={isIncognito}
            onClick={() => setIncognito(!isIncognito)}
            className="incognito"
          >
            <span aria-hidden="true" className="incognito-track">
              <span />
            </span>
            Teach mode
          </button>
        </nav>
      </div>
    </header>
  );
}
