"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { ambassadorCopy } from "../copy";
import type { AdminProfile } from "../dal/admin";
import { updateAmbassadorSchema } from "../schemas/update-ambassador";

type Field = "fullName" | "email" | "mobile";
type Values = Record<Field, string>;
type FieldErrors = Partial<Record<Field, string>>;
type ContactResponse = Pick<AdminProfile, "id" | "fullName" | "email" | "mobile">;
const FIELD_ORDER = ["fullName", "email", "mobile"] as const;

function sanitizeFieldErrors(value: unknown): FieldErrors | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const fields: FieldErrors = {};
  for (const field of FIELD_ORDER) {
    if (typeof source[field] === "string") fields[field] = source[field];
  }
  return Object.keys(fields).length ? fields : undefined;
}

class ContactRequestError extends Error {
  constructor(
    readonly code?: string,
    readonly fields?: FieldErrors,
  ) {
    super("Contact update request failed");
  }
}

async function updateContact(profileId: string, values: Values): Promise<ContactResponse> {
  const response = await fetch(`/api/ambassadors/${profileId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  });
  const text = await response.text();
  let body: {
    id?: unknown;
    fullName?: unknown;
    email?: unknown;
    mobile?: unknown;
    error?: { code?: unknown; fields?: unknown };
  } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ContactRequestError();
  }
  if (!response.ok) {
    throw new ContactRequestError(
      typeof body.error?.code === "string" ? body.error.code : undefined,
      sanitizeFieldErrors(body.error?.fields),
    );
  }
  if (
    body.id !== profileId
    || typeof body.fullName !== "string"
    || typeof body.email !== "string"
    || (body.mobile !== null && typeof body.mobile !== "string")
  ) {
    throw new ContactRequestError();
  }
  return {
    id: body.id,
    fullName: body.fullName,
    email: body.email,
    mobile: body.mobile,
  };
}

export function ContactForm({ profile }: { profile: AdminProfile }) {
  const router = useRouter();
  const submitting = useRef(false);
  const inputRefs = useRef<Record<Field, HTMLInputElement | null>>({
    fullName: null,
    email: null,
    mobile: null,
  });
  const pendingServerFocus = useRef<FieldErrors | null>(null);
  const [values, setValues] = useState<Values>({
    fullName: profile.fullName ?? "",
    email: profile.email,
    mobile: profile.mobile ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const focusFirstInvalid = (next: FieldErrors) => {
    const field = FIELD_ORDER.find((candidate) => next[candidate]);
    if (field) inputRefs.current[field]?.focus();
  };

  const mutation = useMutation({
    mutationFn: (next: Values) => updateContact(profile.id, next),
    onSuccess: (updated) => {
      setValues({
        fullName: updated.fullName ?? "",
        email: updated.email,
        mobile: updated.mobile ?? "",
      });
      router.refresh();
    },
    onError: (error) => {
      const next = error instanceof ContactRequestError ? error.fields ?? {} : {};
      pendingServerFocus.current = next;
      setErrors(next);
    },
    onSettled: () => {
      submitting.current = false;
      if (pendingServerFocus.current) {
        const next = pendingServerFocus.current;
        pendingServerFocus.current = null;
        window.setTimeout(() => focusFirstInvalid(next), 0);
      }
    },
  });

  const validate = () => {
    const result = updateAmbassadorSchema.safeParse(values);
    const next: FieldErrors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as Field;
        if (field in values) next[field] ??= issue.message;
      }
    }
    return next;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const next = validate();
    if (Object.keys(next).length) {
      const firstInvalid = FIELD_ORDER.find((field) => next[field]);
      flushSync(() => setErrors(next));
      if (firstInvalid) {
        form.querySelector<HTMLInputElement>(`#contact-${firstInvalid}`)?.focus();
      }
      return;
    }
    setErrors(next);
    submitting.current = true;
    mutation.mutate(values);
  };

  const failure = mutation.error instanceof ContactRequestError ? mutation.error : null;
  const status = mutation.isSuccess
    ? ambassadorCopy.contactSaved
    : mutation.isError
      ? failure?.code === "CONFLICT"
        ? ambassadorCopy.contactConflict
        : failure?.code === "NOT_FOUND"
          ? ambassadorCopy.contactNotFound
          : failure?.code === "VALIDATION_FAILED"
            ? ambassadorCopy.validationFailed
            : ambassadorCopy.contactFailed
      : null;
  const fields = [
    ["fullName", ambassadorCopy.fullName, "text"],
    ["email", ambassadorCopy.email, "email"],
    ["mobile", ambassadorCopy.mobileOptional, "tel"],
  ] as const;

  return (
    <section aria-labelledby="contact-heading" className="mt-6 rounded bg-[#eae3d2] p-6">
      <h2 className="text-xl font-semibold" id="contact-heading">{ambassadorCopy.contactHeading}</h2>
      <p className="mt-2 max-w-2xl">{ambassadorCopy.contactDuty}</p>
      <form className="mt-5 grid max-w-xl gap-4" noValidate onSubmit={submit}>
        {fields.map(([field, label, type]) => (
          <div key={field}>
            <label className="block font-semibold" htmlFor={`contact-${field}`}>{label}</label>
            <input
              aria-describedby={errors[field] ? `contact-${field}-error` : undefined}
              aria-invalid={Boolean(errors[field])}
              className="mt-1 min-h-11 w-full rounded border border-black bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3344dd] disabled:opacity-60"
              disabled={mutation.isPending}
              id={`contact-${field}`}
              onBlur={() => setErrors((current) => ({ ...current, [field]: validate()[field] }))}
              onChange={(event) => {
                mutation.reset();
                setErrors((current) => ({ ...current, [field]: undefined }));
                setValues((current) => ({ ...current, [field]: event.target.value }));
              }}
              ref={(element) => {
                inputRefs.current[field] = element;
              }}
              type={type}
              value={values[field]}
            />
            {errors[field] ? (
              <p
                className="mt-1 border-l-4 border-[#e41f1f] pl-2 text-black"
                id={`contact-${field}-error`}
              >
                {errors[field]}
              </p>
            ) : null}
          </div>
        ))}
        <button
          className="min-h-11 rounded bg-[#034592] px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3344dd] disabled:opacity-60"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? ambassadorCopy.contactPending : ambassadorCopy.contactSubmit}
        </button>
        <div aria-live="polite" role="status">{status}</div>
      </form>
    </section>
  );
}
