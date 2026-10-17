import { redirect } from "next/navigation";

import { getCurrentUser, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — TutorLog" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  return (
    <>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-muted">
        Accounts are created by the office — ask them for an invite link.
      </p>
    </>
  );
}
