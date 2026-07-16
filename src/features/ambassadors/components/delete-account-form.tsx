"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { ambassadorCopy } from "../copy";
import type { AdminProfile } from "../dal/admin";

class DeleteAccountRequestError extends Error {
  constructor(readonly code?: string) {
    super("Account deletion request failed");
  }
}

async function requestDeletion(profileId: string) {
  const response = await fetch(`/api/ambassadors/${profileId}`, { method: "DELETE" });
  const body = await response.json().catch(() => ({})) as {
    id?: unknown;
    deleted?: unknown;
    error?: { code?: unknown };
  };
  if (!response.ok) {
    throw new DeleteAccountRequestError(
      typeof body.error?.code === "string" ? body.error.code : undefined,
    );
  }
  if (body.id !== profileId || body.deleted !== true) throw new DeleteAccountRequestError();
}

export function DeleteAccountForm({ profile }: { profile: AdminProfile }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation({
    mutationFn: () => requestDeletion(profile.id),
    onSuccess: () => router.replace("/admin/ambassadors"),
    onSettled: () => { submitting.current = false; },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed || submitting.current) return;
    submitting.current = true;
    mutation.mutate();
  };
  const failure = mutation.error instanceof DeleteAccountRequestError ? mutation.error : null;

  return (
    <section aria-labelledby="delete-account-heading" className="mt-6 rounded border border-[#e41f1f] bg-white p-6">
      <h2 className="text-xl font-semibold" id="delete-account-heading">{ambassadorCopy.deleteHeading}</h2>
      <p className="mt-2 max-w-2xl">{ambassadorCopy.deleteBody}</p>
      <form className="mt-5 grid max-w-xl gap-4" onSubmit={submit}>
        <label className="flex min-h-11 items-start gap-3">
          <input
            checked={confirmed}
            className="mt-1 size-5 accent-[#e41f1f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3344dd]"
            disabled={mutation.isPending}
            onChange={(event) => { mutation.reset(); setConfirmed(event.target.checked); }}
            type="checkbox"
          />
          <span>{ambassadorCopy.deleteConfirm}</span>
        </label>
        <button
          className="min-h-11 rounded bg-[#e41f1f] px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3344dd] disabled:opacity-60"
          disabled={!confirmed || mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? ambassadorCopy.deletePending : ambassadorCopy.deleteSubmit}
        </button>
        <div aria-live="polite" role="status">
          {mutation.isError
            ? failure?.code === "NOT_FOUND"
              ? ambassadorCopy.deleteNotFound
              : ambassadorCopy.deleteFailed
            : null}
        </div>
      </form>
    </section>
  );
}
