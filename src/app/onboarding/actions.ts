"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation";

export type OnboardingState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function completeOnboardingAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();

  const parsed = onboardingSchema.safeParse({
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
    siteId: formData.get("siteId"),
    newSiteName: formData.get("newSiteName"),
    newSiteAddress: formData.get("newSiteAddress"),
    defaultDays: formData.get("defaultDays"),
    defaultTimes: formData.get("defaultTimes"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const data = parsed.data;

  // "Add a new site" wins over the dropdown when a name was typed.
  let siteId = data.siteId && data.siteId !== "new" ? data.siteId : null;

  if (data.siteId === "new") {
    if (!data.newSiteName) {
      return { fieldErrors: { newSiteName: "Name the tutoring site" } };
    }
    const site = await prisma.site.upsert({
      where: { name: data.newSiteName },
      update: { address: data.newSiteAddress ?? undefined },
      create: { name: data.newSiteName, address: data.newSiteAddress },
      select: { id: true },
    });
    siteId = site.id;
  }

  if (!siteId) {
    return { fieldErrors: { siteId: "Choose your tutoring site" } };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName: data.displayName,
      phone: data.phone,
      siteId,
      defaultDays: data.defaultDays,
      defaultTimes: data.defaultTimes,
      onboardedAt: new Date(),
    },
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
