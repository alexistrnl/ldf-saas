import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/supabaseServer";

export default async function IndexPage() {
  const authenticated = await isAuthenticated();
  
  if (authenticated) {
    redirect("/home");
  } else {
    redirect("/login");
  }
}

