type MatchPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;

  return (
    <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Match {id}</h1>
      <p className="mt-3 text-[var(--muted)]">
        This page will subscribe to match events and player stat changes in
        Realtime.
      </p>
    </section>
  );
}

