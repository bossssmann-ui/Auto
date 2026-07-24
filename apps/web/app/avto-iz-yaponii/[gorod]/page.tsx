import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JsonLd } from "@/components/JsonLd";
import { TurnkeyCalculator } from "@/components/Calculator/TurnkeyCalculator";
import { GEO_CITIES, getCity, type GeoCity } from "@/lib/geo/cities";
import { ORG, SITE_URL, breadcrumbJsonLd, canonicalUrl } from "@/lib/seo";

export const dynamic = "force-static";

const RUB = new Intl.NumberFormat("ru-RU");

interface Params {
  gorod: string;
}

export function generateStaticParams(): Params[] {
  return GEO_CITIES.map((c) => ({ gorod: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { gorod } = await params;
  const city = getCity(gorod);
  if (!city) return {};

  const title = `Авто из Японии под ключ ${city.namePrepositional} — расчёт и доставка`;
  const description = city.deliveryPriceFromRub === 0
    ? `Импорт авто с японских аукционов с выдачей ${city.namePrepositional}: осмотр и получение на терминале ТЛК без автовоза. Расчёт под ключ в рублях: пошлина, утильсбор, фрахт, СБКТС.`
    : `Импорт авто с японских аукционов с доставкой ${city.namePrepositional} (${city.region}). Автовоз из Владивостока — ориентировочно ${city.deliveryDaysEstimate} дн., от ${RUB.format(city.deliveryPriceFromRub)} ₽. Расчёт под ключ в рублях.`;

  return {
    title,
    description,
    alternates: { canonical: `/avto-iz-yaponii/${city.slug}` },
  };
}

/** Service schema scoped to the city — machine-readable geo coverage. */
function geoServiceJsonLd(city: GeoCity): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Импорт и доставка автомобилей из Японии",
    name: `Авто из Японии под ключ ${city.namePrepositional}`,
    areaServed: {
      "@type": "City",
      name: city.name,
      containedInPlace: { "@type": "AdministrativeArea", name: city.region },
    },
    provider: {
      "@type": "Organization",
      name: ORG.name,
      url: SITE_URL,
    },
    url: canonicalUrl(`/avto-iz-yaponii/${city.slug}`),
  };
}

export default async function GeoCityPage({ params }: { params: Promise<Params> }) {
  const { gorod } = await params;
  const city = getCity(gorod);
  if (!city) notFound();

  const isPickup = city.deliveryPriceFromRub === 0;
  const otherCities = GEO_CITIES.filter((c) => c.slug !== city.slug);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", url: "/" },
          { name: "Импорт авто из Японии", url: "/import-auto-japan" },
          { name: city.name, url: `/avto-iz-yaponii/${city.slug}` },
        ])}
      />
      <JsonLd data={geoServiceJsonLd(city)} />

      <div className="mb-10 space-y-3">
        <span className="label">{city.federalDistrict}</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          Авто из Японии под ключ {city.namePrepositional}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {isPickup ? (
            <>
              Владивосток — точка входа нашей логистики: сюда приходит морской
              фрахт из портов Японии, здесь проходят растаможка и оформление.
              Автомобиль можно осмотреть и получить на терминале ТЛК лично —
              без автовоза и ожидания перегона.
            </>
          ) : (
            <>
              Привозим автомобили с японских аукционов {city.namePrepositional}{" "}
              ({city.region}, {city.federalDistrict}). После растаможки во
              Владивостоке автовоз доставляет машину до вашего города —
              ориентировочно {city.deliveryDaysEstimate} дн., от{" "}
              {RUB.format(city.deliveryPriceFromRub)} ₽ (точный тариф
              подтверждает менеджер).
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild variant="outline">
            <Link href="/catalog">Смотреть лоты</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/import-auto-japan">Как проходит сделка</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-8 md:grid-cols-3">
        <div>
          <span className="label">Маршрут</span>
          <p className="mt-3 text-sm text-muted-foreground">
            Аукцион → порт Японии → морской фрахт → Владивосток (терминал ТЛК) →
            растаможка и документы{isPickup ? " → выдача на терминале" : ` → автовоз ${city.namePrepositional}`}.
          </p>
        </div>
        <div>
          <span className="label">{isPickup ? "Выдача" : "Автовоз"}</span>
          <p className="mt-3 text-sm text-muted-foreground">
            {isPickup
              ? "Осмотр и получение на терминале ТЛК во Владивостоке сразу после оформления документов."
              : `Ориентировочно ${city.deliveryDaysEstimate} дн. в пути, от ${RUB.format(city.deliveryPriceFromRub)} ₽. Сроки зависят от загрузки автовозов и сезона.`}
          </p>
        </div>
        <div>
          <span className="label">Под ключ</span>
          <p className="mt-3 text-sm text-muted-foreground">
            Цена лота + фрахт + пошлина + утильсбор + СБКТС/ЭПТС + фиксированные
            сборы. Всё считается в рублях до сделки — подробнее на странице{" "}
            <Link href="/customs" className="text-foreground underline-offset-2 hover:underline">
              о растаможке
            </Link>
            .
          </p>
        </div>
      </section>

      <Separator className="my-12" />

      <section>
        <h2 className="mb-6 font-display text-2xl font-semibold">
          Посчитать стоимость с доставкой {city.namePrepositional}
        </h2>
        <Suspense fallback={null}>
          <TurnkeyCalculator deliveryCity={city.name} />
        </Suspense>
      </section>

      <Separator className="my-12" />

      <section>
        <h2 className="font-display text-xl font-semibold">Доставка в другие города</h2>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {otherCities.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/avto-iz-yaponii/${c.slug}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Вашего города нет в списке? Возим по всей России —{" "}
          <Link href="/contacts" className="text-foreground underline-offset-2 hover:underline">
            напишите менеджеру
          </Link>
          , посчитаем автовоз до вашего населённого пункта.
        </p>
      </section>
    </div>
  );
}
