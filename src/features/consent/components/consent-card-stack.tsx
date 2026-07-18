"use client";

import { FileCheck2, ShieldCheck, Users } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { TermsManifest } from "../dal/terms";
import { CONSENT_COPY } from "../copy";

export type ConsentActionState = { error: string | null };
const ICONS = [FileCheck2, Users, ShieldCheck] as const;

export function ConsentCardStack({ terms, next, action, declineAction }: { terms: TermsManifest; next: string; action(previous: ConsentActionState, data: FormData): Promise<ConsentActionState>; declineAction?: (previous: ConsentActionState, data: FormData) => Promise<ConsentActionState> }) {
  const [index, setIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [declineState, declineFormAction, declinePending] = useActionState(declineAction ?? action, { error: null });
  const heading = useRef<HTMLHeadingElement>(null);
  const legalTrigger = useRef<HTMLButtonElement>(null);
  const card = terms.cards[index]!;
  const Icon = ICONS[index]!;
  useEffect(() => { if (index > 0) heading.current?.focus(); }, [index]);

  const busy = pending || declinePending;
  return <div className="grid min-h-[560px] gap-6" aria-busy={busy}>
    <p className="sr-only" aria-live="polite">{CONSENT_COPY.position(index + 1, terms.cards.length)}</p>
    <div className="flex items-center justify-center gap-2" aria-label={CONSENT_COPY.position(index + 1, terms.cards.length)}>
      {terms.cards.map((item, dot) => <span key={item.id} className={`size-3 rounded-full border border-surface-media ${dot === index ? "bg-action-primary" : "bg-surface"}`} aria-hidden />)}
      <span className="ml-2 text-sm tabular-count">{CONSENT_COPY.position(index + 1, terms.cards.length)}</span>
    </div>
    <article className="rounded-lg bg-surface-panel p-6 sm:p-8" aria-labelledby={`consent-card-${index}`}>
      <Icon className="mb-4 size-10 text-action-primary" aria-hidden />
      <h2 ref={heading} tabIndex={-1} id={`consent-card-${index}`} className="text-2xl font-bold leading-tight">{card.title}</h2>
      <p className="mt-4 text-base leading-7">{card.body}</p>
      <Button ref={legalTrigger} className="mt-5" variant="link" type="button" onClick={() => setSheetOpen(true)}>{CONSENT_COPY.legalLink}</Button>
    </article>
    {(state.error || declineState.error) && <p role="alert" className="message message-error">{state.error ?? declineState.error}</p>}
    <div className="mt-auto">
      {index < terms.cards.length - 1
        ? <Button key={`advance-${index}`} className="w-full" size="lg" type="button" onClick={() => setIndex((value) => value + 1)}>{CONSENT_COPY.next}</Button>
        : <div className="grid gap-3">
            <form action={formAction}><input type="hidden" name="next" value={next} /><Button key="finish" className="w-full" size="lg" type="submit" disabled={busy}>{pending ? CONSENT_COPY.pending : CONSENT_COPY.finish}</Button></form>
            {declineAction && <form action={declineFormAction}><input type="hidden" name="next" value={next} /><Button className="min-h-11 w-full" variant="tertiary" type="submit" disabled={busy}>{declinePending ? CONSENT_COPY.declining : CONSENT_COPY.decline}</Button></form>}
          </div>}
    </div>
    <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) requestAnimationFrame(() => legalTrigger.current?.focus()); }} title={`${CONSENT_COPY.legalTitle}: ${card.title}`}>{card.legalTextMarkdown}</Sheet>
  </div>;
}
