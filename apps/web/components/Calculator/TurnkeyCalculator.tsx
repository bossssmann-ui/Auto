"use client";

/**
 * Turnkey calculator — customer-facing form + results panel.
 *
 * Hydrates initial values from the URL (spec §7.6.4), submits to the
 * `/api/calculator` route handler, and renders either:
 *   - a price range ("Под ключ: от X ₽ до Y ₽") with a factor breakdown that
 *     mirrors the bot's «ВИЛКА ЦЕНЫ» output, OR
 *   - an operator-required card with a Telegram deep-link when the server
 *     flags the request as sanctioned / moto > 600 k ¥ / special.
 *
 * All state lives in this component — the `/calculator` page stays a static
 * shell so the SSG pipeline is untouched.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  calculatorInputSchema,
  type CalculatorInput,
  type CalculatorResult,
} from "@/lib/calculator-schema";
import {
  decodeCalculatorState,
  encodeCalculatorState,
} from "@/lib/calculator-url";
import { LeadDialog } from "@/components/Lead/LeadDialog";
import { isSanctionedVehicle } from "@auto/shared";

// Reasonable defaults that produce a realistic-looking calc on first load.
const DEFAULTS: CalculatorInput = {
  vehicleType: "car",
  volumeCm3: 2000,
  ageYears: 4,
  fuelType: "ice",
  isVan: false,
  priceJpyLow: 1_500_000,
  priceJpyHigh: 2_200_000,
  isForResale: false,
  isLegalEntity: false,
};

const TELEGRAM_BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "spectechmash_bot";

const RUB = new Intl.NumberFormat("ru-RU");
const fmtRub = (v: number) => `${RUB.format(v)} ₽`;
const JPY = new Intl.NumberFormat("ru-RU");

const VEHICLE_LABELS: Record<CalculatorInput["vehicleType"], string> = {
  car: "легковой",
  jeep: "внедорожник / SUV",
  moto: "мотоцикл",
};

const FUEL_LABELS: Record<CalculatorInput["fuelType"], string> = {
  ice: "бензин",
  hybrid: "гибрид",
  electric: "электро",
  diesel: "дизель",
};

/**
 * Human-readable calculation context attached to a lead so the manager sees
 * exactly what the visitor calculated (params + resulting range).
 */
function buildLeadContext(
  state: CalculatorInput,
  result: CalculatorResult,
  deliveryCity?: string,
): { interest: string; meta: Record<string, string> } {
  const params = [
    VEHICLE_LABELS[state.vehicleType],
    FUEL_LABELS[state.fuelType],
    state.fuelType === "electric" ? null : `${state.volumeCm3} см³`,
    `${state.ageYears} лет`,
    state.isVan ? "van" : null,
    state.isLegalEntity ? "юрлицо" : null,
    state.isForResale ? "перепродажа" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const meta: Record<string, string> = {
    "Параметры расчёта": params,
    "Аукционная цена": `${JPY.format(state.priceJpyLow)}–${JPY.format(state.priceJpyHigh)} ¥`,
  };
  if (result.requiresOperator) {
    meta["Статус расчёта"] = `требуется оператор — ${result.reason}`;
  } else {
    meta["Вилка под ключ"] =
      `от ${fmtRub(result.low.finalTotalRub)} до ${fmtRub(result.high.finalTotalRub)}`;
  }
  if (deliveryCity) meta["Город доставки"] = deliveryCity;
  return { interest: `Расчёт: ${params}`, meta };
}

type FieldErrors = Partial<Record<keyof CalculatorInput, string>>;

export interface TurnkeyCalculatorProps {
  /**
   * Pre-selected delivery city (geo pages, P3-06): shown next to the result
   * and attached to the lead request so the manager sees the destination.
   */
  deliveryCity?: string;
}

export function TurnkeyCalculator({ deliveryCity }: TurnkeyCalculatorProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<CalculatorInput>(DEFAULTS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [share, setShare] = useState<
    { kind: "copied" } | { kind: "manual"; url: string } | null
  >(null);

  // Hydrate from URL once. We only read searchParams on mount — further
  // navigation uses `router.replace` with shallow intent via `scroll:false`.
  useEffect(() => {
    const decoded = decodeCalculatorState(searchParams);
    if (decoded) setState(decoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof CalculatorInput>(key: K, value: CalculatorInput[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const tgHref = useMemo(() => {
    const sp = encodeCalculatorState(state);
    return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=calc_${encodeURIComponent(sp.toString())}`;
  }, [state]);

  const isElectric = state.fuelType === "electric";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setShare(null);

    // Coerce the electric-volume rule so the input being disabled is enough.
    const normalizedState: CalculatorInput = {
      ...state,
      volumeCm3: isElectric ? 0 : state.volumeCm3,
    };

    const parsed = calculatorInputSchema.safeParse(normalizedState);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CalculatorInput | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    // Client-side sanction gate — same rule the server enforces. Saves a
    // round-trip and avoids flashing a spinner when the answer is static.
    if (
      isSanctionedVehicle(
        parsed.data.vehicleType,
        parsed.data.volumeCm3,
        parsed.data.fuelType === "diesel" ? "ice" : parsed.data.fuelType,
        parsed.data.isVan,
      )
    ) {
      setResult({
        requiresOperator: true,
        reason:
          "Это санкционный автомобиль (Япония → РФ с августа 2023). Индивидуальный фрахт — расчёт и подтверждение через оператора.",
      });
      syncUrl(parsed.data);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/calculator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        setSubmitError("Не удалось посчитать. Попробуйте ещё раз.");
        return;
      }
      const json = (await res.json()) as CalculatorResult;
      setResult(json);
      syncUrl(parsed.data);
    } catch {
      setSubmitError("Сеть недоступна. Попробуйте повторить расчёт.");
    } finally {
      setSubmitting(false);
    }
  }

  function syncUrl(data: CalculatorInput) {
    const sp = encodeCalculatorState(data);
    router.replace(`/calculator?${sp.toString()}`, { scroll: false });
  }

  async function onShare() {
    const sp = encodeCalculatorState(state);
    const url = `${window.location.origin}/calculator?${sp.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setShare({ kind: "copied" });
      setTimeout(() => setShare(null), 3000);
    } catch {
      // Clipboard API unavailable (http, permissions) — give the visitor a
      // selectable field instead of a bare URL string.
      setShare({ kind: "manual", url });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Параметры расчёта</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <FormRow label="Тип техники" error={errors.vehicleType}>
              <SelectNative
                value={state.vehicleType}
                onChange={(v) => update("vehicleType", v as CalculatorInput["vehicleType"])}
                options={[
                  { value: "car", label: "Легковой" },
                  { value: "jeep", label: "Внедорожник / SUV" },
                  { value: "moto", label: "Мотоцикл" },
                ]}
              />
            </FormRow>

            <FormRow label="Тип топлива" error={errors.fuelType}>
              <SelectNative
                value={state.fuelType}
                onChange={(v) => {
                  const fuel = v as CalculatorInput["fuelType"];
                  update("fuelType", fuel);
                  if (fuel === "electric") update("volumeCm3", 0);
                }}
                options={[
                  { value: "ice", label: "Бензин" },
                  { value: "hybrid", label: "Гибрид" },
                  { value: "electric", label: "Электро" },
                  { value: "diesel", label: "Дизель" },
                ]}
              />
            </FormRow>

            <div className="grid grid-cols-2 gap-4">
              <FormRow label="Объём, см³" error={errors.volumeCm3}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10000}
                  value={state.volumeCm3}
                  disabled={isElectric}
                  onChange={(e) => update("volumeCm3", Number(e.target.value) || 0)}
                />
              </FormRow>
              <FormRow label="Возраст, лет" error={errors.ageYears}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={40}
                  value={state.ageYears}
                  onChange={(e) => update("ageYears", Number(e.target.value) || 0)}
                />
              </FormRow>
            </div>

            <div>
              <div className="label mb-2">Аукционная цена, ¥ (вилка)</div>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="от" error={errors.priceJpyLow}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={10000}
                    value={state.priceJpyLow}
                    onChange={(e) => update("priceJpyLow", Number(e.target.value) || 0)}
                  />
                </FormRow>
                <FormRow label="до" error={errors.priceJpyHigh}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={10000}
                    value={state.priceJpyHigh}
                    onChange={(e) => update("priceJpyHigh", Number(e.target.value) || 0)}
                  />
                </FormRow>
              </div>
            </div>

            <div className="space-y-3">
              <Checkbox
                checked={state.isVan}
                onChange={(v) => update("isVan", v)}
                label="Микроавтобус / фургон (van)"
              />
              <Checkbox
                checked={state.isLegalEntity}
                onChange={(v) => update("isLegalEntity", v)}
                label="Покупатель — юрлицо"
              />
              <Checkbox
                checked={state.isForResale}
                onChange={(v) => update("isForResale", v)}
                label="Для перепродажи"
              />
            </div>

            {submitError ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Считаем…" : "Посчитать под ключ"}
              </Button>
              <Button type="button" variant="outline" onClick={onShare}>
                Поделиться расчётом
              </Button>
            </div>

            <div aria-live="polite">
              {share?.kind === "copied" ? (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm"
                >
                  <span aria-hidden="true">✓</span> Ссылка на расчёт скопирована
                </div>
              ) : null}
              {share?.kind === "manual" ? (
                <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
                  <label
                    htmlFor="calc-share-url"
                    className="text-sm text-muted-foreground"
                  >
                    Не удалось скопировать автоматически — выделите и скопируйте
                    ссылку:
                  </label>
                  <Input
                    id="calc-share-url"
                    readOnly
                    value={share.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                </div>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        {submitting ? <ResultSkeleton /> : null}
        {!submitting && result ? (
          <ResultPanel
            result={result}
            tgHref={tgHref}
            state={state}
            deliveryCity={deliveryCity}
          />
        ) : null}
        {!submitting && !result ? <EmptyResult /> : null}
      </div>
    </div>
  );
}

function FormRow({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="label block">{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function SelectNative({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input"
      />
      {label}
    </label>
  );
}

function ResultSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

function EmptyResult() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display">Результат</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Заполните параметры слева и нажмите «Посчитать под ключ» — покажем вилку цены в рублях с расшифровкой по пошлине, утилю, фрахту и фиксам.
      </CardContent>
    </Card>
  );
}

function ResultPanel({
  result,
  tgHref,
  state,
  deliveryCity,
}: {
  result: CalculatorResult;
  tgHref: string;
  state: CalculatorInput;
  deliveryCity?: string;
}) {
  const lead = buildLeadContext(state, result, deliveryCity);

  if (result.requiresOperator) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Передаю оператору</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{result.reason}</p>
          <div className="flex flex-wrap gap-3">
            <LeadDialog
              label="Получить точную смету"
              source="calculator"
              defaultInterest={lead.interest}
              meta={lead.meta}
              title="Получить точную смету"
              description="Оператор посчитает этот вариант вручную и свяжется с вами. Параметры расчёта прикрепим к заявке."
            />
            <Button asChild variant="outline">
              <Link href={tgHref} target="_blank" rel="noopener noreferrer">
                Написать оператору в Telegram
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { low, high, sanctioned } = result;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-display">Под ключ в РФ</CardTitle>
          {sanctioned ? <Badge variant="outline">санкционный фрахт</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="font-display text-[28px] leading-tight font-semibold md:text-[32px]">
          от {fmtRub(low.finalTotalRub)} до {fmtRub(high.finalTotalRub)}
        </div>

        <Separator />

        <div>
          <div className="label mb-3">Из чего складывается</div>
          <dl className="divide-y divide-border text-sm">
            <FactorRow label="Япония (FOB + локал)" low={low.japanTotalRub} high={high.japanTotalRub} />
            <FactorRow label="Фрахт" low={low.freightRub} high={high.freightRub} />
            <FactorRow label="Таможенная пошлина" low={low.customsDutyRub} high={high.customsDutyRub} />
            <FactorRow label="Утильсбор" low={low.utilFeeRub} high={high.utilFeeRub} />
            <FactorRow label="Фиксы (СВХ, брокер, СБКТС)" low={low.fixedFeesRub} high={high.fixedFeesRub} />
          </dl>
        </div>

        <p className="text-xs text-muted-foreground">
          Курсы применены банковские (ЦБ × 1.04 на JPY и USD): JPY {low.appliedRates.JPY.toFixed(4)} ₽ · USD {low.appliedRates.USD.toFixed(2)} ₽ · EUR {low.appliedRates.EUR.toFixed(2)} ₽.
        </p>

        <p className="text-xs text-muted-foreground">
          Расчёт предварительный — точную смету под конкретный лот подтверждает
          менеджер.
        </p>

        {deliveryCity ? (
          <p className="text-xs text-muted-foreground">
            Город доставки: {deliveryCity}. Автовоз от Владивостока считается
            отдельно — укажем в смете.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <LeadDialog
            label="Получить точную смету"
            source="calculator"
            defaultInterest={lead.interest}
            meta={lead.meta}
            title="Получить точную смету"
            description="Менеджер проверит расчёт под конкретный лот и свяжется с вами. Параметры и вилку прикрепим к заявке."
          />
          <Button asChild variant="outline">
            <Link href={tgHref} target="_blank" rel="noopener noreferrer">
              Уточнить у оператора
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FactorRow({ label, low, high }: { label: string; low: number; high: number }) {
  const same = low === high;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">
        {same ? fmtRub(low) : `${fmtRub(low)} — ${fmtRub(high)}`}
      </dd>
    </div>
  );
}
