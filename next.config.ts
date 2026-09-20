import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg opens raw TCP sockets, so it must stay external to the server bundle.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
