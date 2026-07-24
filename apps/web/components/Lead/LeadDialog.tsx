"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactLeadForm } from "@/components/Lead/ContactLeadForm";
import type { LeadSource } from "@/lib/lead-schema";

export interface LeadDialogProps {
  /** Trigger button label. */
  label: string;
  source: LeadSource;
  /** Prefilled "interest" line, e.g. lot title or calculator summary. */
  defaultInterest?: string;
  /** Context forwarded to the manager (lot id, calc params, price range). */
  meta?: Record<string, string>;
  title?: string;
  description?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}

/**
 * Lead-capture CTA: a button that opens the shared `ContactLeadForm` in a
 * dialog with page-specific context (source, interest, meta) attached to the
 * submission. Used on the calculator and lot pages so a visitor can send a
 * request without leaving the page.
 */
export function LeadDialog({
  label,
  source,
  defaultInterest,
  meta,
  title = "Оставить заявку",
  description = "Менеджер свяжется с вами и уточнит детали. Контекст страницы прикрепим к заявке автоматически.",
  size,
  variant,
  className,
}: LeadDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size={size} variant={variant} className={className}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ContactLeadForm
          source={source}
          defaultInterest={defaultInterest}
          meta={meta}
          className="relative"
        />
      </DialogContent>
    </Dialog>
  );
}
