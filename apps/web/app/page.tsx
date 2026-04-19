import Link from "next/link";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <BentoGrid>
        {/* Hero tile — spec §4.2 allows one dominant tile. */}
        <BentoTile
          colSpan={8}
          rowSpan={2}
          className="relative isolate overflow-hidden bg-card"
        >
          {/* Single subtle radial glow — the only gradient we allow (spec §4.1). */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-1/3 left-1/2 -z-10 h-[120%] w-[80%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,var(--muted),transparent_70%)]"
          />
          <div className="space-y-6">
            <span className="label">Auction-direct · Japan · Korea · China</span>
            <h1 className="font-display text-[40px] leading-tight font-semibold tracking-tight md:text-[56px] lg:text-[72px]">
              Аукционные лоты под ключ — без посредников.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground md:text-lg">
              Мы подбираем и привозим автомобили, мототехнику и спецтехнику с японских, корейских и
              китайских аукционов. Всё включено: таможня, утильсбор, доставка до ТЛК.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/catalog">Смотреть каталог</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/calculator">Рассчитать стоимость</Link>
            </Button>
          </div>
        </BentoTile>

        {/* Supporting tiles. */}
        <BentoTile colSpan={4}>
          <span className="label">Featured lot</span>
          <h2 className="mt-6 font-display text-2xl font-semibold">Toyota Harrier · XU80</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Аукционная оценка 4.5 · пробег 43 000 км · 2022 г.
          </p>
          <div className="mt-8 space-y-1">
            <p className="label">Под ключ в РФ</p>
            <p className="font-display text-3xl font-semibold tabular-nums">от 3 850 000 ₽</p>
          </div>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Today · ¥/₽</span>
          <h3 className="mt-6 font-display text-2xl font-semibold">Калькулятор под ключ</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Курс ЦБ + банковский спред, пошлина, утильсбор и логистика в одной формуле.
          </p>
          <Button asChild variant="ghost" size="sm" className="mt-6 w-fit px-0 text-foreground">
            <Link href="/calculator">Открыть калькулятор →</Link>
          </Button>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Logistics</span>
          <h3 className="mt-6 font-display text-2xl font-semibold">Терминал ТЛК</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Растаможка во Владивостоке, автовоз по всей России. Собственная логистика.
          </p>
          <Button asChild variant="ghost" size="sm" className="mt-6 w-fit px-0 text-foreground">
            <Link href="/about">Как мы возим →</Link>
          </Button>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Telegram bot</span>
          <h3 className="mt-6 font-display text-2xl font-semibold">Расчёт в чате</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Подбор по параметрам и расчёт стоимости прямо в Telegram. Ответ за 3–5 минут.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <Badge variant="outline">AI</Badge>
            <Badge variant="outline">amoCRM</Badge>
          </div>
        </BentoTile>
      </BentoGrid>

      <Separator className="my-16" />

      <div className="grid gap-8 md:grid-cols-3">
        <div>
          <p className="label">What we do</p>
          <h2 className="mt-3 font-display text-2xl font-semibold">Аукционный подбор</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            USS, TAA, HAA и корейские площадки. Мы читаем аукционный лист до торгов, вы — после.
          </p>
        </div>
        <div>
          <p className="label">Pricing</p>
          <h2 className="mt-3 font-display text-2xl font-semibold">Прозрачная смета</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Каждая строка: FOB, фрахт, таможня, утильсбор, фикс. Без «плавающих» комиссий.
          </p>
        </div>
        <div>
          <p className="label">Delivery</p>
          <h2 className="mt-3 font-display text-2xl font-semibold">Под ключ</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            СБКТС, ЭПТС, постановка на учёт — по желанию. Договор на каждый этап.
          </p>
        </div>
      </div>
    </div>
  );
}
