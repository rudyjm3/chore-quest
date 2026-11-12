"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { avatarGlyph } from "@/lib/avatars";

import { childSignInAction, lookupFamilyAction } from "../actions";

type Lookup = Awaited<ReturnType<typeof lookupFamilyAction>>;
type SignIn = Awaited<ReturnType<typeof childSignInAction>>;

/** Two-step child sign-in: family code → pick your name → PIN. */
export function ChildSignIn() {
  const [lookup, lookupAction] = useActionState<Lookup | null, FormData>(lookupFamilyAction, null);
  const [signIn, signInAction] = useActionState<SignIn | null, FormData>(childSignInAction, null);

  const family = lookup?.ok && lookup.data.found ? lookup.data : null;

  if (!family) {
    return (
      <form action={lookupAction} className="space-y-4" data-testid="child-signin-step-code">
        <h1 className="text-2xl font-black">Ahoy, matey!</h1>
        <p className="text-sm">Ask a grown-up for your family code.</p>
        <div className="space-y-1.5">
          <Label htmlFor="familyCode">Family code</Label>
          <Input
            id="familyCode"
            name="familyCode"
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 text-center text-2xl tracking-[0.4em] uppercase"
            maxLength={12}
            required
          />
        </div>
        {lookup && (!lookup.ok || !lookup.data.found) ? (
          <p className="text-sm font-semibold text-danger" role="alert">
            {lookup.ok
              ? "Hmm, no crew with that code. Check with a grown-up!"
              : lookup.error.message}
          </p>
        ) : null}
        <SubmitButton className="h-12 w-full text-lg" pendingText="Looking…">
          Find my crew
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={signInAction} className="space-y-4" data-testid="child-signin-step-pin">
      <h1 className="text-2xl font-black">{family.familyName}</h1>
      <input type="hidden" name="familyCode" value={family.familyCode} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Who are you?</legend>
        <div className="grid grid-cols-2 gap-2">
          {family.children.map((child, i) => (
            <label
              key={child.id}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-pirate-wood/40 bg-white/60 px-3 py-3 text-base font-bold has-checked:border-pirate-gold has-checked:bg-pirate-gold/30"
            >
              <input
                type="radio"
                name="childId"
                value={child.id}
                defaultChecked={i === 0}
                className="size-4"
                required
              />
              <span aria-hidden className="text-2xl">
                {avatarGlyph(child.avatarKey)}
              </span>
              {child.displayName}
            </label>
          ))}
        </div>
        {family.children.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No children with a PIN yet. Ask a grown-up to set one.
          </p>
        ) : null}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="pin">Secret PIN</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          className="h-12 text-center text-2xl tracking-[0.5em]"
          maxLength={6}
          required
        />
      </div>
      {signIn && !signIn.ok ? (
        <p className="text-sm font-semibold text-danger" role="alert">
          {signIn.error.message}
        </p>
      ) : null}
      <SubmitButton className="h-12 w-full text-lg" pendingText="Boarding…">
        Set sail!
      </SubmitButton>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => window.location.reload()}
      >
        Different family code
      </Button>
    </form>
  );
}
