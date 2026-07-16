"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { ambassadorCopy } from "../copy";
import type { AdminProfile } from "../dal/admin";
import type { AccountLifecycleValues } from "../schemas/account-lifecycle";

class LifecycleRequestError extends Error {
  constructor(readonly code?: string) {
    super("Account lifecycle request failed");
  }
}

async function updateLifecycle(
  profileId: string,
  action: AccountLifecycleValues["action"],
): Promise<Pick<AdminProfile, "id" | "accountState">> {
  const response = await fetch(`/api/ambassadors/${profileId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const text = await response.text();
  let body: {
    id?: unknown;
    accountState?: unknown;
    error?: { code?: unknown };
  } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new LifecycleRequestError();
  }
  if (!response.ok) {
    throw new LifecycleRequestError(
      typeof body.error?.code === "string" ? body.error.code : undefined,
    );
  }
  if (
    body.id !== profileId
    || (body.accountState !== "active" && body.accountState !== "deactivated")
  ) {
    throw new LifecycleRequestError();
  }
  return {
    id: body.id,
    accountState: body.accountState,
  };
}

export function AccountLifecycleForm({ profile }: { profile: AdminProfile }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [confirmed, setConfirmed] = useState(false);
  const action: AccountLifecycleValues["action"] | null = profile.accountState === "deactivated"
    ? "reactivate"
    : profile.accountState === "active" || profile.accountState === "invited"
      ? "deactivate"
      : null;

  const mutation = useMutation({
    mutationFn: (nextAction: AccountLifecycleValues["action"]) => updateLifecycle(profile.id, nextAction),
    onSuccess: () => {
      setConfirmed(false);
      router.refresh();
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!action || submitting.current) return;
    if (action === "deactivate" && !confirmed) return;
    submitting.current = true;
    mutation.mutate(action);
  };

  const failure = mutation.error instanceof LifecycleRequestError ? mutation.error : null;
  const status = mutation.isSuccess
    ? action === "reactivate"
      ? ambassadorCopy.lifecycleReactivated
      : ambassadorCopy.lifecycleDeactivated
    : mutation.isError
      ? failure?.code === "CONFLICT"
        ? ambassadorCopy.lifecycleConflict
        : failure?.code === "NOT_FOUND"
          ? ambassadorCopy.lifecycleNotFound
          : ambassadorCopy.lifecycleFailed
      : null;
  const disabled = mutation.isPending || !action || (action === "deactivate" && !confirmed);

  return (
    <section aria-labelledby="lifecycle-heading" className="mt-6 rounded bg-[#eae3d2] p-6">
      <h2 className="text-xl font-semibold" id="lifecycle-heading">{ambassadorCopy.lifecycleHeading}</h2>
      <p className="mt-2 max-w-2xl">
        {!action
          ? ambassadorCopy.lifecycleUnsupportedBody
          : profile.accountState === "deactivated"
          ? ambassadorCopy.lifecycleDeactivatedBody
          : ambassadorCopy.lifecycleActiveBody}
      </p>
      <form className="mt-5 grid max-w-xl gap-4" onSubmit={submit}>
        {action === "deactivate" ? (
          <label className="flex min-h-11 items-start gap-3">
            <input
              checked={confirmed}
              className="mt-1 size-5 accent-[#034592] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3344dd]"
              disabled={mutation.isPending}
              onChange={(event) => {
                mutation.reset();
                setConfirmed(event.target.checked);
              }}
              type="checkbox"
            />
            <span>{ambassadorCopy.deactivateConfirm}</span>
          </label>
        ) : null}
        <button
          className="min-h-11 rounded bg-[#034592] px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3344dd] disabled:opacity-60"
          disabled={disabled}
          type="submit"
        >
          {mutation.isPending
            ? ambassadorCopy.lifecyclePending
            : !action
              ? ambassadorCopy.lifecycleUnavailable
              : action === "reactivate"
              ? ambassadorCopy.reactivateSubmit
              : ambassadorCopy.deactivateSubmit}
        </button>
        <div aria-live="polite" role="status">{status}</div>
      </form>
    </section>
  );
}
