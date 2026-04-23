type PlayerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { id } = await params;

  return (
    <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Player {id}</h1>
      <p className="mt-3 text-[var(--muted)]">
        This route will show player profile data, current match context, and
        recent performance snapshots.
      </p>
    </section>
  );
}

