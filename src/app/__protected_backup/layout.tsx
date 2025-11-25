// src/app/(protected)/layout.tsx

import { ReactNode } from "react";

import { cookies } from "next/headers";

import { redirect } from "next/navigation";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

type Props = {
  children: ReactNode;
};

export default async function ProtectedLayout({ children }: Props) {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <>{children}</>;
}

