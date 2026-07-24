"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LeadInput, LeadSource } from "@/lib/lead-schema";

type Status = "idle" | "submitting" | "success" | "error";

interface FieldErrors {
  name?: string;
  phone?: string;
}

function validate(name: string, phone: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = "Укажите ваше имя";
  const digits = (phone.match(/\d/g) ?? []).length;
  if (!phone.trim()) errors.phone = "Укажите номер телефона";
  else if (digits < 10)
    errors.phone = "Укажите телефон полностью, с кодом города или оператора";
  return errors;
}

export interface ContactLeadFormProps {
  /** Lead source recorded with the submission. */
  source?: LeadSource;
  /** Prefilled "interest" context, e.g. a lot title. */
  defaultInterest?: string;
  /** Extra context forwarded to the manager (lot id, calculator params, …). */
  meta?: Record<string, string>;
  className?: string;
}

/**
 * Lead-capture form posting to `/api/lead`. Client-side validation for the
 * required name/phone, full idle → submitting → success/error state machine,
 * and a honeypot field for basic spam protection.
 */
export function ContactLeadForm({
  source = "contacts",
  defaultInterest = "",
  meta,
  className,
}: ContactLeadFormProps) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [interest, setInterest] = React.useState(defaultInterest);
  const [comment, setComment] = React.useState("");
  const [website, setWebsite] = React.useState(""); // honeypot
  const [status, setStatus] = React.useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errors = validate(name, phone);
    setFieldErrors(errors);
    if (errors.name || errors.phone) return;

    setStatus("submitting");
    const payload: LeadInput = {
      name: name.trim(),
      phone: phone.trim(),
      source,
      interest: interest.trim() || undefined,
      comment: comment.trim() || undefined,
      pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      website: website || undefined,
      meta,
    };

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean };
      setStatus(res.ok && json.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className={cn(
          "rounded-lg border border-border bg-muted/40 p-6 text-sm",
          className,
        )}
      >
        <p className="font-medium">Заявка отправлена</p>
        <p className="mt-1 text-muted-foreground">
          Спасибо! Менеджер свяжется с вами в рабочее время — в среднем за 15
          минут.
        </p>
      </div>
    );
  }

  const textareaClass =
    "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:text-sm dark:bg-input/30";

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-4", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="lead-name" className="text-sm font-medium">
            Имя <span aria-hidden="true">*</span>
          </label>
          <Input
            id="lead-name"
            name="name"
            autoComplete="name"
            placeholder="Как к вам обращаться"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "lead-name-error" : undefined}
            disabled={status === "submitting"}
          />
          {fieldErrors.name ? (
            <p id="lead-name-error" className="text-sm text-destructive">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="lead-phone" className="text-sm font-medium">
            Телефон <span aria-hidden="true">*</span>
          </label>
          <Input
            id="lead-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+7 900 000-00-00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? "lead-phone-error" : undefined}
            disabled={status === "submitting"}
          />
          {fieldErrors.phone ? (
            <p id="lead-phone-error" className="text-sm text-destructive">
              {fieldErrors.phone}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="lead-interest" className="text-sm font-medium">
          Интересующая техника или лот
        </label>
        <Input
          id="lead-interest"
          name="interest"
          placeholder="Например: Toyota Harrier 2022 или мини-экскаватор"
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          disabled={status === "submitting"}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="lead-comment" className="text-sm font-medium">
          Комментарий
        </label>
        <textarea
          id="lead-comment"
          name="comment"
          rows={3}
          placeholder="Бюджет, сроки, вопросы — всё, что поможет менеджеру"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={status === "submitting"}
          className={textareaClass}
        />
      </div>

      {/* Honeypot: hidden from humans (and screen readers), attracts bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="lead-website">Website</label>
        <input
          id="lead-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          Не удалось отправить заявку. Попробуйте ещё раз или напишите нам в
          Telegram — кнопка справа.
        </p>
      ) : null}

      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Отправляем…" : "Отправить заявку"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Нажимая «Отправить заявку», вы соглашаетесь на обработку персональных
        данных.
      </p>
    </form>
  );
}
