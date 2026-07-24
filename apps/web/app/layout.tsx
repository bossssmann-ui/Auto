import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { ThemeProvider, ThemeScript } from "@/components/theme-provider";
import { TopNav } from "@/components/Shell/TopNav";
import { Footer } from "@/components/Shell/Footer";
import { JsonLd } from "@/components/JsonLd";
import {
  ORG,
  SITE_URL,
  autoDealerJsonLd,
  ogImageUrl,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

// Inter is our workhorse body font (variable, 100–900). Shipped via
// `@fontsource-variable/inter` so the build doesn't depend on Google Fonts
// at build time. Display (Satoshi) is layered on top via CSS when the local
// woff2 files are present — see `apps/web/public/fonts/README.md`. Until
// then we fall back to Inter 600 for headlines: Satoshi is a paid font and
// we do not ship it without the user's files.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${ORG.name} — импорт авто из Японии, Кореи и Китая`,
    template: `%s · ${ORG.name}`,
  },
  description: ORG.description,
  applicationName: ORG.name,
  alternates: {
    canonical: "/",
    languages: { "ru-RU": "/" },
  },
  openGraph: {
    type: "website",
    siteName: ORG.name,
    locale: "ru_RU",
    url: SITE_URL,
    title: `${ORG.name} — импорт авто из Японии, Кореи и Китая`,
    description: ORG.description,
    images: [
      {
        url: ogImageUrl({
          title: ORG.name,
          subtitle: "Импорт авто из Японии, Кореи и Китая",
          kind: "home",
        }),
        width: 1200,
        height: 630,
        alt: ORG.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${ORG.name} — импорт авто из Японии, Кореи и Китая`,
    description: ORG.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeScript />
        {/*
          Preconnect to the real auction CDN as soon as the host is known.
          Env-driven so the sandbox stays hermetic; uncomment the hard-coded
          fallback when the CDN is fixed.
        */}
        {process.env.NEXT_PUBLIC_AUCTION_CDN_ORIGIN ? (
          <link
            rel="preconnect"
            href={process.env.NEXT_PUBLIC_AUCTION_CDN_ORIGIN}
            crossOrigin="anonymous"
          />
        ) : null}
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <JsonLd data={autoDealerJsonLd()} />
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
