import { signOut } from "@/app/actions/auth";
import { AppFooter, AppNav } from "@/components/chrome";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="wrap">
      <AppNav
        signOut={
          <form action={signOut}>
            <button type="submit" className="linkbtn">
              Sign out
            </button>
          </form>
        }
      />
      <main>{children}</main>
      <AppFooter />
    </div>
  );
}
