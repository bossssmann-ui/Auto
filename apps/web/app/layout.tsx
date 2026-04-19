import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { ThemeProvider, ThemeScript } from "@/components/theme-provider";
import { TopNav } from "@/components/Shell/TopNav";
import { Footer } from "@/components/Shell/Footer";

// Inter is our workhorse body font (variable, 100–900). Shipped via
// `@fontsource-variable/inter` so the build doesn't depend on Google Fonts
// at build time. Display (Satoshi) is layered on top via CSS when the local
// woff2 files are present — see `apps/web/public/fonts/README.md`. Until
// then we fall back to Inter 600 for headlines: Satoshi is a paid font and
// we do not ship it without the user's files.

export const metadata: Metadata = {
  title: "СпецТехМаш — импорт авто из Японии, Кореи и Китая",
  description:
    "Аукционные лоты из Японии, Кореи и Китая. Расчёт стоимости под ключ в рублях, логистика через ТЛК.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <TopNav />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
