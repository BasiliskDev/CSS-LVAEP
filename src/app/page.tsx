import { redirect } from "next/navigation";

import { currentUserDestination } from "./(auth)/actions";

export default async function Home() {
  redirect(await currentUserDestination());
}
