import Link from "next/link";

import type { SessionUser } from "@/lib/auth";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui";

/** Header + centred content column shared by every signed-in page. */
export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="font-semibold text-ink">
            Tutor<span className="text-brand">Log</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/dashboard">Students</NavLink>
            <NavLink href="/calendar">Calendar</NavLink>
            {user.role === "ADMIN" ? <NavLink href="/admin">Office</NavLink> : null}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {user.displayName}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-line px-4 py-4 text-center text-xs text-faint">
        Literacy Volunteers of America, Essex/Passaic County · Replaces the Student
        Monthly Attendance &amp; Achievement Form
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2.5 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </Link>
  );
}
