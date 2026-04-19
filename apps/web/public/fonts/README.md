# Fonts

Drop `Satoshi-Variable.woff2` (or the individual weight files) into this folder
and wire them up via `next/font/local` in `apps/web/app/layout.tsx` to enable
the display font defined in `globals.css` (`--font-display`).

Until then the site falls back to Inter 600 for headlines — that is intentional.
Satoshi is a paid/licensed font and we will not commit binaries without the
owner's files.
