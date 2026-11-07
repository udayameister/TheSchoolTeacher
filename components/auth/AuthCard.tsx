export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="container-page flex justify-center py-8 sm:py-12">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
