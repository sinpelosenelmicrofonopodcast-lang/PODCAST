"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Options = {
  require21?: boolean;
};

type State = {
  checking: boolean;
  userId: string | null;
};

export function useProtectedUser(options?: Options): State {
  const require21 = options?.require21 === true;
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<State>({ checking: true, userId: null });

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      if (!mounted) return;

      if (!userId) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
        setState({ checking: false, userId: null });
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("user_status, is_21_confirmed")
        .eq("id", userId)
        .single();

      if (!mounted) return;

      if (profile?.user_status === "blocked") {
        await supabase.auth.signOut();
        router.replace("/login?blocked=1");
        setState({ checking: false, userId: null });
        return;
      }

      if (require21 && profile?.is_21_confirmed !== true) {
        router.replace("/register?age=required");
        setState({ checking: false, userId: null });
        return;
      }

      setState({ checking: false, userId });
    };

    run();
    return () => {
      mounted = false;
    };
  }, [pathname, require21, router]);

  return state;
}

