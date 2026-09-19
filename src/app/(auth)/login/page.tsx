import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — TutorLog" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardedAt ? "/dashboard" : "/onboarding");

  return (
    <>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-muted">
        New tutor?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
