import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd, type FaqItem } from "@/lib/seo";

/**
 * Server-rendered FAQ block + matching FAQPage JSON-LD. Content is plain
 * HTML (no client JS), so search engines and AI crawlers see the full text.
 */
export function Faq({ title = "Частые вопросы", items }: { title?: string; items: FaqItem[] }) {
  return (
    <section className="mt-16">
      <JsonLd data={faqJsonLd(items)} />
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <dl className="mt-6 divide-y divide-border">
        {items.map((item) => (
          <div key={item.question} className="py-5">
            <dt className="font-medium">{item.question}</dt>
            <dd className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
