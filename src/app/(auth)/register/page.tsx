import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create an account — TutorLog" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardedAt ? "/dashboard" : "/onboarding");

  return (
    <>
      <RegisterForm />
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
