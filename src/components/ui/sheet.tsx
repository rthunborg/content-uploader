// customized: Fleet Deck modal sheet with explicit accessible close control.
"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "./button";

export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange(open: boolean): void; title: string; children: ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
      <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-xl bg-surface p-6 shadow-xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[min(520px,100vw)] sm:rounded-none">
        <div className="mb-6 flex items-start justify-between gap-4">
          <Dialog.Title className="text-2xl font-bold">{title}</Dialog.Title>
          <Dialog.Close asChild><Button variant="secondary" size="icon" aria-label="Stäng"><X aria-hidden /></Button></Dialog.Close>
        </div>
        <Dialog.Description asChild><div className="whitespace-pre-wrap text-base leading-7">{children}</div></Dialog.Description>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
