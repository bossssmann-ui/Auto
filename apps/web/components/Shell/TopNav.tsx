"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/catalog", label: "Каталог" },
  { href: "/calculator", label: "Калькулятор" },
  { href: "/about", label: "О компании" },
  { href: "/contacts", label: "Контакты" },
];

/**
 * Sticky top navigation. Translucent by default; reveals a subtle border
 * and backdrop-blur only after 8 px of scroll (spec §4.6 rule 1).
 */
export function TopNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-[background,border-color] duration-150 ease-out",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-md"
          : "border-b border-transparent bg-background/0",
      )}
    >
      <nav
        aria-label="Основная навигация"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-6 lg:px-8"
      >
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          СпецТехМаш
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm transition-colors duration-150 ease-out",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm" variant="default" className="hidden sm:inline-flex">
            <Link href="/contacts">Связаться</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
