import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Your profile — TutorLog" };

/**
 * First run this collects the tutor block printed at the top of the paper form.
 * Afterwards the same page serves as the profile editor, so there is one form to
 * maintain rather than two that drift apart.
 */
export default async function OnboardingPage() {
  const user = await requireUser();

  const [sites, profile] = await Promise.all([
    prisma.site.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        displayName: true,
        phone: true,
        siteId: true,
        defaultDays: true,
        defaultTimes: true,
      },
    }),
  ]);

  const isFirstRun = !user.onboardedAt;

  const form = (
    <div className="mx-auto w-full max-w-lg">
      <h1 className="text-xl font-semibold text-ink">
        {isFirstRun ? "Set up your profile" : "Your profile"}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        This is the tutor information printed at the top of every attendance form.
      </p>
      <OnboardingForm
        sites={sites}
        isFirstRun={isFirstRun}
        profile={{
          displayName: profile?.displayName ?? user.displayName,
          phone: profile?.phone ?? "",
          siteId: profile?.siteId ?? "",
          defaultDays: profile?.defaultDays ?? "",
          defaultTimes: profile?.defaultTimes ?? "",
        }}
      />
    </div>
  );

  // Before onboarding there is no dashboard to frame the page with.
  if (isFirstRun) return <div className="px-4 py-10">{form}</div>;
  return <AppShell user={user}>{form}</AppShell>;
}
