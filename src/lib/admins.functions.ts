import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const EMAIL_DOMAIN = "clinic.local";

function loginToEmail(login: string) {
  return `${login.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

// Создаёт первого owner-админа admin/123456 если в системе ещё нет ни одного owner.
// Идемпотентно. Вызывается со страницы логина.
export const seedFirstAdminIfNeeded = createServerFn({ method: "POST" }).handler(
  async () => {
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "owner");

    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) return { seeded: false };

    const email = loginToEmail("admin");
    const password = "123456";

    // Создаём пользователя
    const { data: userData, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createErr) {
      // если юзер уже существует — найдём его
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existing = list.users.find((u) => u.email === email);
      if (!existing) throw new Error(createErr.message);
      await ensureAdminRecords(existing.id, "admin");
      return { seeded: true };
    }

    const userId = userData.user!.id;
    await ensureAdminRecords(userId, "admin");
    return { seeded: true };
  },
);

async function ensureAdminRecords(userId: string, login: string) {
  await supabaseAdmin
    .from("admin_profiles")
    .upsert({ user_id: userId, login, display_name: login });
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });
}

const CreateAdminSchema = z.object({
  login: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "Только латиница, цифры, _ и -"),
  password: z.string().min(6).max(100),
  role: z.enum(["owner", "editor"]),
  displayName: z.string().max(100).optional(),
});

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateAdminSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Только owner может создавать админов
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isOwner = roles?.some((r) => r.role === "owner");
    if (!isOwner) throw new Error("Только владелец может добавлять админов");

    const email = loginToEmail(data.login);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    const userId = created.user!.id;
    await supabaseAdmin.from("admin_profiles").insert({
      user_id: userId,
      login: data.login,
      display_name: data.displayName ?? data.login,
    });
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });

    return { userId };
  });

export const deleteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isOwner = roles?.some((r) => r.role === "owner");
    if (!isOwner) throw new Error("Только владелец может удалять админов");
    if (data.userId === context.userId)
      throw new Error("Нельзя удалить самого себя");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("admin_profiles")
      .select("user_id, login, display_name, created_at")
      .order("created_at");
    if (error) throw new Error(error.message);

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("user_id, role");

    return (data ?? []).map((a) => ({
      ...a,
      roles: (roles ?? [])
        .filter((r) => r.user_id === a.user_id)
        .map((r) => r.role),
    }));
  });

export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ newPassword: z.string().min(6).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      context.userId,
      { password: data.newPassword },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
