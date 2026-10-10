"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteAccount() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error(`[account] delete failed: ${error.message}`);
    redirect("/board?error=delete");
  }
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
