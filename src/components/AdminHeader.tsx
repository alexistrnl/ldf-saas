"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminNav from "./AdminNav";

type AdminHeaderProps = {
  title: string;
  description: string;
};

export default function AdminHeader({ title, description }: AdminHeaderProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserEmail(user?.email || null);
      } catch (error) {
        console.error("[AdminHeader] Error loading user:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null);
      } else {
        setUserEmail(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="flex-shrink-0 px-6 pt-8 pb-4 border-b border-white/10 bg-[#020617]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          <p className="text-slate-400">{description}</p>
        </div>
        
        {/* Utilisateur connecté */}
        {!loading && userEmail && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-sm text-slate-300">{userEmail}</span>
          </div>
        )}
      </div>
      
      {/* Navigation Admin */}
      <AdminNav />
    </div>
  );
}
