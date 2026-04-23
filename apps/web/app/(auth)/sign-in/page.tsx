import { signIn } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <section className="mx-auto max-w-md rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <form action={signIn} className="mt-6 space-y-4">
        <input
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-white/70 px-4 py-3"
          name="email"
          type="email"
          placeholder="Email"
          required
        />
        <input
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-white/70 px-4 py-3"
          name="password"
          type="password"
          placeholder="Password"
          required
        />
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

