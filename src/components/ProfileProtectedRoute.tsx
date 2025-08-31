import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Props = { children: ReactNode };

export default function ProfileProtectedRoute({ children }: Props) {
  const [state, setState] = useState<
    { status: "loading" } |
    { status: "allow" } |
    { status: "redirect" }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) {
          if (!cancelled) setState({ status: "redirect" });
          return;
        }

        // Fetch only what we need; '*' is fine too if your schema is stable
        const { data, error } = await supabase
          .from("profiles")
          .select("id, profile_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          // IMPORTANT: On API/DB error we DO NOT block the app;
          // let the user through so you don't get stuck on /profile-setup.
          console.error("ProfileProtectedRoute: profiles fetch error → allowing access", error);
          if (!cancelled) setState({ status: "allow" });
          return;
        }

        // No row yet, or not completed → go to setup
        if (!data || data.profile_completed === false) {
          if (!cancelled) setState({ status: "redirect" });
          return;
        }

        // Completed → allow
        if (!cancelled) setState({ status: "allow" });
      } catch (err) {
        console.error("ProfileProtectedRoute: unexpected error → allowing access", err);
        if (!cancelled) setState({ status: "allow" });
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") return null; // or a spinner
  if (state.status === "redirect") return <Navigate to="/profile-setup" replace />;
  return <>{children}</>;
}
