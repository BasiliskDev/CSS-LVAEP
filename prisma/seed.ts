import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
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
    console.log(`Admin "${username}" already exists — leaving it alone.`);
  } else {
    await prisma.user.create({
      data: {
        username,
        displayName: "Office Admin",
        passwordHash: await bcrypt.hash(password, 10),
        role: "ADMIN",
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
