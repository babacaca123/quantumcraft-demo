import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

/**
 * The signed-in user plus a request-bound Supabase client. Middleware already
 * bounces anonymous traffic; this is the belt-and-braces check that also gives
 * server components and actions their client.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return { supabase, user };
}

/**
 * v1 tracks a single house build, so the project row is created on first use
 * rather than made a thing the user has to set up.
 */
export async function getOrCreateProject(): Promise<{
  project: Project;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}> {
  const { supabase, user } = await requireUser();

  const { data: existing, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existing) return { project: existing as Project, supabase, userId: user.id };

  const { data: created, error: insertError } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: "House Build" })
    .select("*")
    .single();

  if (insertError) throw new Error(insertError.message);

  return { project: created as Project, supabase, userId: user.id };
}
