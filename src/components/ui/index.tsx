import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Hand-rolled primitives. Small enough not to warrant a component library, and
 * they keep every screen visually consistent by construction.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// --- Button -----------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "border border-danger/40 bg-danger-soft text-danger hover:bg-danger/15",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// --- Surfaces ---------------------------------------------------------------

export function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cx("rounded-lg border border-line bg-surface shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// --- Form fields ------------------------------------------------------------

const FIELD_BASE =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint disabled:bg-surface-2 disabled:text-muted";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cx(FIELD_BASE, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cx(FIELD_BASE, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={cx(FIELD_BASE, "pr-8", className)} {...props} />;
}

export function Checkbox({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      type="checkbox"
      className={cx(
        "h-4 w-4 shrink-0 rounded border-line-strong text-brand accent-brand",
        className,
      )}
      {...props}
    />
  );
}

// --- Feedback ---------------------------------------------------------------

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "positive" | "accent" | "danger";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    brand: "bg-brand-soft text-brand",
    positive: "bg-positive-soft text-positive",
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger-soft text-danger",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-muted">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {sublabel ? <p className="mt-0.5 text-xs text-faint">{sublabel}</p> : null}
    </Card>
  );
}
