"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/Shell/BrandMark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  const [menuOpen, setMenuOpen] = React.useState(false);

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
        <Link href="/" aria-label="SpecTechMash — на главную">
          <BrandMark compact />
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

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="md:hidden"
                aria-label="Открыть меню"
                aria-expanded={menuOpen}
              >
                <MenuIcon className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Меню</SheetTitle>
                <SheetDescription className="sr-only">
                  Навигация по разделам сайта
                </SheetDescription>
              </SheetHeader>
              <ul className="flex flex-col gap-1 px-4">
                {NAV_ITEMS.map((item) => {
                  const active =
                    pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "block rounded-lg px-3 py-2.5 text-base transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            active
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 px-4">
                <SheetClose asChild>
                  <Button asChild className="w-full">
                    <Link href="/contacts">Связаться</Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
