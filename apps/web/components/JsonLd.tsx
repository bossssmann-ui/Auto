import type { ReactElement } from "react";

/**
 * Emits a `<script type="application/ld+json">` block. The payload is
 * JSON-serialized; no user input should ever reach this component unsanitized
 * (we only feed it SEO builders in `lib/seo.ts`).
 *
 * React strips the script content into `dangerouslySetInnerHTML` — this is
 * the idiomatic Next.js pattern for structured data and is safe here because
 * `JSON.stringify` produces valid JSON with no unescaped script-terminators
 * for our own data. We additionally escape `</` for defense in depth.
 */
export function JsonLd({ data }: { data: unknown }): ReactElement {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
