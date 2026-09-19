export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xl font-semibold text-ink">
            Tutor<span className="text-brand">Log</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            Literacy Volunteers of America, Essex/Passaic County
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
