import { ResetPasswordForm } from "@/features/families/components/auth-forms";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" && !params.error ? params.token : undefined;
  return <ResetPasswordForm token={token} />;
}
