"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Brand = Database["public"]["Tables"]["brands"]["Row"];

interface AuthState {
  user: User | null;
  brand: Brand | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (currentUser) {
          setUser(currentUser);

          const { data: brandData } = await supabase
            .from("brands")
            .select("*")
            .eq("auth_user_id", currentUser.id)
            .single();

          if (mounted) {
            setBrand(brandData);
          }
        } else {
          setUser(null);
          setBrand(null);
        }
      } catch {
        if (mounted) {
          setUser(null);
          setBrand(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);

        const { data: brandData } = await supabase
          .from("brands")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .single();

        if (mounted) {
          setBrand(brandData);
        }
      } else {
        setUser(null);
        setBrand(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setBrand(null);
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  return { user, brand, loading, signOut };
}
