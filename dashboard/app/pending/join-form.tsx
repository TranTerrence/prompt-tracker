"use client";

import { useActionState } from "react";
import { joinWithCode, type JoinState } from "./actions";

// Formulaire « J'ai un code de classe » : la voie normale de rattachement.
export default function JoinForm() {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(
    joinWithCode,
    { error: null }
  );

  return (
    <form action={formAction} className="mt-6 space-y-3 text-left">
      <label htmlFor="code" className="block text-sm font-medium">
        J&apos;ai un code de classe
      </label>
      <div className="flex gap-2">
        <input
          id="code"
          name="code"
          type="text"
          maxLength={10}
          autoComplete="off"
          spellCheck={false}
          placeholder="ex. ABC2345"
          className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm uppercase tracking-widest outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Patiente…" : "Rejoindre"}
        </button>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
