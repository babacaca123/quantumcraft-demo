import { Wordmark } from "@/components/chrome";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — House Build Tracker" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="wrap" style={{ maxWidth: 480 }}>
      <div className="stack gap-24" style={{ paddingTop: 96, paddingBottom: 64 }}>
        <Wordmark />

        <div>
          <div className="eyebrow">House build tracker</div>
          <h1 style={{ fontSize: 34, marginTop: 10 }}>Sign in to the ledger.</h1>
          <p className="sub" style={{ fontSize: 16, marginTop: 12 }}>
            One account, one build. Phases, subs, tasks, receipts and the profit line.
          </p>
        </div>

        <LoginForm next={next ?? "/"} />

        <div className="micro">
          single-user tool · accounts are created in the supabase dashboard
        </div>
      </div>
    </div>
  );
}
