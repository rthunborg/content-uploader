"use client";

import { useActionState } from "react";

import {
  INITIAL_LOGIN_STATE,
  requestMagicLink,
} from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(
    requestMagicLink,
    INITIAL_LOGIN_STATE,
  );

  return (
    <form action={formAction} className="login-form">
      <input name="next" type="hidden" value={next} />
      <div className="field-group">
        <label htmlFor="email">E-postadress</label>
        <input
          autoComplete="email"
          id="email"
          name="email"
          placeholder="namn@stena.com"
          required
          type="email"
        />
      </div>
      <button disabled={isPending} type="submit">
        {isPending ? "Skickar länken…" : "Skicka inloggningslänk"}
      </button>
      {state.message ? (
        <p aria-live="polite" className={`message message-${state.status}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
