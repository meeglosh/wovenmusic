// src/routes/AuthGate.tsx
import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const PUBLIC_PATH_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/playlist/shared",
  "/public",
  "/privacy",
  "/terms",
];

function isPublicRoute(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((p) =>
    pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?")
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<
    { loading: boolean; exists: boolean | null; error?: string }
  >({ loading: false, exists: null });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUserId(data.session?.user?.id || null);
      setAuthReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id || null);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!authReady) return;
      if (!userId) {
        setProfileState({ loading: false, exists: null });
        return;
      }
      setProfileState({ loading: true, exists: null });
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        const code = (error as any)?.code || "";
        if (code === "PGRST116") {
          setProfileState({ loading: false, exists: false });
        } else if (code === "42501" || code === "401" || code === "403") {
          setProfileState({ loading: false, exists: null, error: "unauthorized" });
        } else {
          setProfileState({ loading: false, exists: null, error: "fetch_error" });
        }
      } else {
        setProfileState({ loading: false, exists: !!data });
      }
    };
    run();
  }, [authReady, userId]);

  const content = useMemo(() => {
    if (isPublicRoute(location.pathname)) return <>{children}</>;
    if (!authReady) return null; // or a small spinner

    if (!userId) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (profileState.loading || profileState.exists === null) {
      return <>{children}</>;
    }

    if (profileState.exists === false && location.pathname !== "/profile-setup") {
      return <Navigate to="/profile-setup" replace state={{ from: location }} />;
    }

    return <>{children}</>;
  }, [authReady, userId, profileState, location, children]);

  return content;
}
