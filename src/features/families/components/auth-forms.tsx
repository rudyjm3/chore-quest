"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/auth-client";

/** Only same-site relative paths are allowed as post-auth destinations (no open redirects). */
export function safeNext(next: string | undefined | null): string | undefined {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : undefined;
}

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: safeNext(next) ?? "/parent",
    });
    setPending(false);
    if (error) {
      toast.error(
        error.status === 403
          ? "Please confirm your email first. We just sent you a new link."
          : (error.message ?? "Could not sign in"),
      );
      return;
    }
    router.push(safeNext(next) ?? "/parent");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="sign-in-form">
      <h1 className="text-xl font-bold">Parent sign in</h1>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-brand underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"}
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Create a family
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { data, error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: safeNext(next) ?? "/parent/onboarding",
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Could not create account");
      return;
    }
    if (!data?.token) {
      // Email verification is on: no session until the link in the email is opened.
      setCheckEmail(true);
      return;
    }
    router.push(safeNext(next) ?? "/parent/onboarding");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="space-y-3" data-testid="check-email">
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="text-sm text-muted-foreground" role="status">
          We sent a confirmation link. Open it to finish creating your account, then sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="sign-up-form">
      <h1 className="text-xl font-bold">Create your parent account</h1>
      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password (10+ characters)</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"}
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}

/** Revokes every session of this parent account (all browsers and devices), then returns to sign-in. */
export function SignOutEverywhereButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.revokeSessions();
        if (error) {
          setPending(false);
          toast.error(error.message ?? "Could not sign out everywhere");
          return;
        }
        router.push("/sign-in");
        router.refresh();
      }}
    >
      {pending ? "Signing out…" : "Sign out everywhere"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Could not send the email");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3" data-testid="reset-sent">
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="text-sm text-muted-foreground" role="status">
          If an account exists for that address, we sent a link to choose a new password.
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="forgot-password-form">
      <h1 className="text-xl font-bold">Reset your password</h1>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/sign-in" className="text-brand underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Link expired</h1>
        <p className="text-sm text-muted-foreground" role="alert">
          This reset link is invalid or has expired.{" "}
          <Link href="/forgot-password" className="text-brand underline-offset-4 hover:underline">
            Request a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) {
      setPending(false);
      toast.error("The passwords do not match");
      return;
    }
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Could not reset the password");
      return;
    }
    toast.success("Password changed. Please sign in.");
    router.push("/sign-in");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="reset-password-form">
      <h1 className="text-xl font-bold">Choose a new password</h1>
      <div className="space-y-1.5">
        <Label htmlFor="password">New password (10+ characters)</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
