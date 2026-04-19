import { ImageResponse } from "next/og";
import { ORG } from "@/lib/seo";

/**
 * Dynamic Open Graph image endpoint.
 *
 * Reads `?title=`, `?subtitle=`, `?kind=lot|category|home|page` and renders a
 * 1200×630 branded tile. Design-system compliant: single subtle radial glow,
 * Inter 600 for title, Inter 400 for subtitle, no emoji, neutral palette.
 *
 * Nothing user-controllable is evaluated as HTML — we render through
 * `ImageResponse` which treats all strings as text.
 */

export const runtime = "nodejs";
export const revalidate = 3600;
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

// Clamp incoming strings so a crafted URL can't blow up layout.
function clamp(s: string | null, max: number, fallback = ""): string {
  if (!s) return fallback;
  const trimmed = s.trim();
  if (trimmed.length === 0) return fallback;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export async function GET(req: Request): Promise<ImageResponse> {
  const { searchParams } = new URL(req.url);
  const title = clamp(searchParams.get("title"), 80, ORG.name);
  const subtitle = clamp(
    searchParams.get("subtitle"),
    120,
    "Импорт авто из Японии, Кореи, Китая",
  );
  const rawKind = searchParams.get("kind") ?? "page";
  const kind = ["lot", "category", "home", "page"].includes(rawKind)
    ? rawKind
    : "page";
  const kindLabel =
    kind === "lot"
      ? "Auction lot"
      : kind === "category"
        ? "Catalog"
        : kind === "home"
          ? "Home"
          : "Page";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          // Neutral near-black background — matches the dark-theme surface token.
          background: "#0A0A0A",
          color: "#FAFAFA",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Single radial glow — the only gradient allowed per §4.1. */}
        <div
          style={{
            position: "absolute",
            top: "-30%",
            left: "20%",
            width: "80%",
            height: "120%",
            background:
              "radial-gradient(circle at center, rgba(245,245,245,0.08), transparent 70%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", zIndex: 1 }}>
          <div
            style={{
              fontSize: 20,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#A1A1AA",
              display: "flex",
            }}
          >
            {kindLabel} · {ORG.name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            zIndex: 1,
            maxWidth: "980px",
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                fontSize: 30,
                fontWeight: 400,
                color: "#A1A1AA",
                lineHeight: 1.35,
                display: "flex",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#A1A1AA",
            zIndex: 1,
          }}
        >
          <span style={{ display: "flex" }}>
            Auction-direct · Japan / Korea / China
          </span>
          <span style={{ display: "flex" }}>Под ключ в ₽ по курсу ЦБ</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
