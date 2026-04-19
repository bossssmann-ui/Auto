"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      onClick={toggle}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
