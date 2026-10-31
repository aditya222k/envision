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
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <Link href="/" className="wordmark mr-auto">
          Envision
        </Link>
        <nav
          aria-label="Main"
          className="order-last w-full sm:order-none sm:w-auto"
        >
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
        </nav>
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
      </div>
    </header>
  );
}
