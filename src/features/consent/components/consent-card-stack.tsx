"use client";

import { FileCheck2, ShieldCheck, Users } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { TermsManifest } from "../dal/terms";
import { CONSENT_COPY } from "../copy";

export type ConsentActionState = { error: string | null };
const ICONS = [FileCheck2, Users, ShieldCheck] as const;

export function ConsentCardStack({ terms, termsVersionId, termsPayloadSha256, next, action, declineAction, mode = "first-login", changedCardIds = [] }: { terms: TermsManifest; termsVersionId: string; termsPayloadSha256: string; next: string; action(previous: ConsentActionState, data: FormData): Promise<ConsentActionState>; declineAction?: (previous: ConsentActionState, data: FormData) => Promise<ConsentActionState>; mode?: "first-login" | "reaccept"; changedCardIds?: TermsManifest["cards"][number]["id"][] | null }) {
  const [index, setIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advanceLocked, setAdvanceLocked] = useState(false);
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [declineState, declineFormAction, declinePending] = useActionState(declineAction ?? action, { error: null });
  const advanceLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const legalTrigger = useRef<HTMLButtonElement>(null);
  const card = terms.cards[index]!;
  const changed = mode === "reaccept" && changedCardIds?.includes(card.id);
  const Icon = ICONS[index]!;
  useEffect(() => { if (index > 0) heading.current?.focus(); }, [index]);
  useEffect(() => {
    if (!advanceLocked) return;
    const timeout = window.setTimeout(() => {
      advanceLock.current = false;
      setAdvanceLocked(false);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [advanceLocked]);

  const busy = pending || declinePending || advanceLocked;
  return <div className="grid min-h-[560px] gap-6" aria-busy={busy}>
    {mode === "reaccept" && <div className="rounded-lg border-2 border-action-primary bg-selected-bg p-4" role="status"><h2 className="font-bold">{CONSENT_COPY.changedTitle}</h2><p>{changedCardIds && changedCardIds.length > 0 ? CONSENT_COPY.changedIntro : CONSENT_COPY.changedGeneric}</p></div>}
    <p className="sr-only" aria-live="polite">{CONSENT_COPY.position(index + 1, terms.cards.length)}</p>
    <div className="flex items-center justify-center gap-2" aria-label={CONSENT_COPY.position(index + 1, terms.cards.length)}>
      {terms.cards.map((item, dot) => <span key={item.id} className={`size-3 rounded-full border border-surface-media ${dot === index ? "bg-action-primary" : "bg-surface"}`} aria-hidden />)}
      <span className="ml-2 text-sm tabular-count">{CONSENT_COPY.position(index + 1, terms.cards.length)}</span>
    </div>
    <article className={`rounded-lg bg-surface-panel p-6 sm:p-8 ${changed ? "border-2 border-action-primary" : ""}`} aria-labelledby={`consent-card-${index}`}>
      {changed && <p className="mb-3 font-bold text-action-primary">{CONSENT_COPY.changedMarker}</p>}
      <Icon className="mb-4 size-10 text-action-primary" aria-hidden />
      <h2 ref={heading} tabIndex={-1} id={`consent-card-${index}`} className="text-2xl font-bold leading-tight">{card.title}</h2>
      <p className="mt-4 text-base leading-7">{card.body}</p>
      <Button ref={legalTrigger} className="mt-5" variant="link" type="button" onClick={() => setSheetOpen(true)}>{CONSENT_COPY.legalLink}</Button>
    </article>
    {(state.error || declineState.error) && <p role="alert" className="message message-error">{state.error ?? declineState.error}</p>}
    <div className="mt-auto">
      {index < terms.cards.length - 1
        ? <Button key={`advance-${index}`} className="w-full" size="lg" type="button" disabled={advanceLocked} onClick={() => { if (advanceLock.current) return; advanceLock.current = true; setAdvanceLocked(true); setIndex((value) => Math.min(value + 1, terms.cards.length - 1)); }}>{CONSENT_COPY.next}</Button>
        : <div className="grid gap-3">
            <form action={formAction}><input type="hidden" name="next" value={next} /><input type="hidden" name="termsVersionId" value={termsVersionId} /><input type="hidden" name="termsPayloadSha256" value={termsPayloadSha256} /><Button key="finish" className="w-full" size="lg" type="submit" disabled={busy}>{pending ? (mode === "reaccept" ? CONSENT_COPY.reacceptPending : CONSENT_COPY.pending) : (mode === "reaccept" ? CONSENT_COPY.reacceptFinish : CONSENT_COPY.finish)}</Button></form>
            {declineAction && <form action={declineFormAction}><input type="hidden" name="next" value={next} /><Button className="min-h-11 w-full" variant="tertiary" type="submit" disabled={busy}>{declinePending ? CONSENT_COPY.declining : CONSENT_COPY.decline}</Button></form>}
          </div>}
    </div>
    <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) requestAnimationFrame(() => legalTrigger.current?.focus()); }} title={`${CONSENT_COPY.legalTitle}: ${card.title}`}>{card.legalTextMarkdown}</Sheet>
  </div>;
}
