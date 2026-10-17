import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** The site printed on the original form. */
const SITES = [
  { name: "Bloomfield Public Library", address: "90 Broad Street, Bloomfield, NJ 07003" },
];

async function main() {
  for (const site of SITES) {
    await prisma.site.upsert({
      where: { name: site.name },
      update: { address: site.address },
      create: site,
    });
  }

  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const site = await prisma.site.findUnique({ where: { name: SITES[0].name } });

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    // Self-registration is closed and the app has no password reset, so this is the only
    // way back into a locked-out office account. It is opt-in precisely because a seed
    // that silently reset a password on every deploy would be a back door.
    if (process.env.SEED_ADMIN_RESET === "1") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: await bcrypt.hash(password, 10), role: "ADMIN" },
      });
      console.log(`Reset admin "${username}" to the password in SEED_ADMIN_PASSWORD.`);
    } else {
      console.log(`Admin "${username}" already exists — leaving it alone.`);
      console.log("To reset its password, re-run with SEED_ADMIN_RESET=1.");
    }
  } else {
    await prisma.user.create({
      data: {
        username,
        displayName: "Office Admin",
        passwordHash: await bcrypt.hash(password, 10),
        role: "ADMIN",
        email: process.env.SEED_ADMIN_EMAIL ?? null,
        siteId: site?.id,
        onboardedAt: new Date(),
      },
    });
    console.log(`Created admin "${username}" with password "${password}".`);
    console.log("Change it after first login.");
  }

  console.log(`Seeded ${SITES.length} site(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
