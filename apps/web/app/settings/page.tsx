export default function SettingsPage() {
  return (
    <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-3 max-w-2xl text-[var(--muted)]">
        This page will manage favorite players, teams, competitions, and user
        preferences stored in Supabase.
      </p>
    </section>
  );
}

