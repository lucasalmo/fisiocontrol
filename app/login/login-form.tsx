"use client";

import { Activity, LockKeyhole } from "lucide-react";
import { useActionState } from "react";
import { loginAction } from "@/features/auth/actions";
import { Alert, Button, Card, Field, Input } from "@/components/ui/primitives";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  return (
    <Card className="w-full max-w-sm p-6">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="grid size-10 place-items-center rounded-xl bg-accent text-white dark:text-black">
          <Activity className="size-5" strokeWidth={2.5} aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold">FisioControl</h1>
          <p className="text-sm text-fg-3">Acesso restrito ao seu histórico de tratamento.</p>
        </div>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Senha" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        </Field>
        {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
        <Button type="submit" variant="primary" disabled={pending} className="justify-center">
          <LockKeyhole className="size-4" aria-hidden />
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </Card>
  );
}
