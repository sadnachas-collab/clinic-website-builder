import crypto from "node:crypto";
import process from "node:process";
import { dbQuery } from "./clinic-db.server";

export type ClinicAdmin = {
  id: string;
  login: string;
  display_name: string | null;
  role: "owner" | "editor";
};

const SESSION_COOKIE = "clinic_admin_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function seedFirstAdminIfEnabled() {
  if (process.env.SEED_FIRST_ADMIN !== "true") return { seeded: false };
  const login = process.env.INITIAL_ADMIN_LOGIN?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!login || !password) {
    throw new Error("INITIAL_ADMIN_LOGIN and INITIAL_ADMIN_PASSWORD are required");
  }
  validateLogin(login);
  if (password.length < 12) throw new Error("INITIAL_ADMIN_PASSWORD must be at least 12 symbols");

  const owners = await dbQuery<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.app_admins WHERE role = 'owner'",
  );
  if (Number(owners.rows[0]?.count || 0) > 0) return { seeded: false };

  await dbQuery(
    "INSERT INTO public.app_admins (login, password_hash, display_name, role) VALUES ($1, $2, $3, 'owner') ON CONFLICT (login) DO NOTHING",
    [login, hashPassword(password), login],
  );
  return { seeded: true };
}

export async function loginAdmin(loginRaw: string, password: string) {
  const login = loginRaw.trim().toLowerCase();
  validateLogin(login);
  const result = await dbQuery<ClinicAdmin & { password_hash: string }>(
    "SELECT id, login, password_hash, display_name, role FROM public.app_admins WHERE login = $1",
    [login],
  );
  const admin = result.rows[0];
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    throw new HttpError(401, "Неверный логин или пароль");
  }
  const token = signSession(admin);
  return {
    admin: publicAdmin(admin),
    cookie: serializeCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: process.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge: TOKEN_TTL_SECONDS,
    }),
  };
}

export async function getCurrentAdmin(request: Request): Promise<ClinicAdmin | null> {
  const token = parseCookies(request.headers.get("cookie") || "")[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  const result = await dbQuery<ClinicAdmin>(
    "SELECT id, login, display_name, role FROM public.app_admins WHERE id = $1",
    [payload.id],
  );
  return result.rows[0] ?? null;
}

export async function requireAdmin(request: Request) {
  const admin = await getCurrentAdmin(request);
  if (!admin) throw new HttpError(401, "Требуется вход в админку");
  return admin;
}

export async function requireOwner(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.role !== "owner") throw new HttpError(403, "Доступно только владельцу");
  return admin;
}

export async function listAdmins(request: Request) {
  await requireAdmin(request);
  const result = await dbQuery<ClinicAdmin & { created_at: string }>(
    "SELECT id, login, display_name, role, created_at FROM public.app_admins ORDER BY created_at ASC",
  );
  return result.rows.map((admin) => ({
    user_id: admin.id,
    login: admin.login,
    display_name: admin.display_name,
    created_at: admin.created_at,
    roles: [admin.role],
  }));
}

export async function createAdmin(request: Request, body: unknown) {
  await requireOwner(request);
  const data = asAdminPayload(body);
  validateLogin(data.login);
  if (!data.role) throw new HttpError(400, "Роль администратора обязательна");
  if (!data.password || data.password.length < 6) {
    throw new HttpError(400, "Пароль должен быть не короче 6 символов");
  }
  const result = await dbQuery<{ id: string }>(
    "INSERT INTO public.app_admins (login, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [data.login, hashPassword(data.password), data.displayName || data.login, data.role],
  );
  return { userId: result.rows[0].id };
}

export async function updateAdmin(request: Request, body: unknown) {
  const actor = await requireOwner(request);
  const data = asAdminPayload(body);
  if (!data.userId) throw new HttpError(400, "userId is required");

  if (data.role && data.userId === actor.id && data.role !== "owner") {
    throw new HttpError(400, "Нельзя снять с себя роль владельца");
  }
  if (data.role && data.role !== "owner") {
    const target = await dbQuery<{ role: "owner" | "editor" }>(
      "SELECT role FROM public.app_admins WHERE id = $1",
      [data.userId],
    );
    if (target.rows[0]?.role === "owner") {
      const owners = await dbQuery<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.app_admins WHERE role = 'owner'",
      );
      if (Number(owners.rows[0]?.count || 0) <= 1) {
        throw new HttpError(400, "Нельзя снять роль с последнего владельца");
      }
    }
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (data.displayName !== undefined) {
    values.push(data.displayName);
    updates.push(`display_name = $${values.length}`);
  }
  if (data.role) {
    values.push(data.role);
    updates.push(`role = $${values.length}`);
  }
  if (data.newPassword) {
    if (data.newPassword.length < 6) throw new HttpError(400, "Пароль слишком короткий");
    values.push(hashPassword(data.newPassword));
    updates.push(`password_hash = $${values.length}`);
  }
  if (updates.length === 0) return { ok: true };
  values.push(data.userId);
  await dbQuery(
    `UPDATE public.app_admins SET ${updates.join(", ")} WHERE id = $${values.length}`,
    values,
  );
  return { ok: true };
}

export async function deleteAdmin(request: Request, body: unknown) {
  const actor = await requireOwner(request);
  const userId = asObject(body).userId;
  if (typeof userId !== "string") throw new HttpError(400, "userId is required");
  if (userId === actor.id) throw new HttpError(400, "Нельзя удалить самого себя");
  await dbQuery("DELETE FROM public.app_admins WHERE id = $1 AND role <> 'owner'", [userId]);
  return { ok: true };
}

export async function changeOwnPassword(request: Request, body: unknown) {
  const actor = await requireAdmin(request);
  const newPassword = asObject(body).newPassword;
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    throw new HttpError(400, "Пароль должен быть не короче 6 символов");
  }
  await dbQuery("UPDATE public.app_admins SET password_hash = $1 WHERE id = $2", [
    hashPassword(newPassword),
    actor.id,
  ]);
  return { ok: true };
}

export function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 0,
  });
}

function publicAdmin(admin: ClinicAdmin) {
  return {
    id: admin.id,
    login: admin.login,
    displayName: admin.display_name,
    role: admin.role,
  };
}

function validateLogin(login: string) {
  if (!/^[a-zA-Z0-9_-]{2,50}$/.test(login)) {
    throw new HttpError(400, "Логин может содержать только латиницу, цифры, _ и -");
  }
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltRaw, hashRaw] = parts;
  const expected = Buffer.from(hashRaw, "base64url");
  const actual = crypto.scryptSync(password, Buffer.from(saltRaw, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return secret || "development-only-session-secret";
}

function signSession(admin: ClinicAdmin) {
  const payload = Buffer.from(
    JSON.stringify({
      id: admin.id,
      login: admin.login,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token: string): { id: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  if (!constantEqual(signature, expected)) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    id?: string;
    exp?: number;
  };
  if (!parsed.id || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return { id: parsed.id };
}

function constantEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function parseCookies(header: string) {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    secure?: boolean;
    path?: string;
    maxAge?: number;
  },
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

function asAdminPayload(body: unknown) {
  const data = asObject(body);
  return {
    userId: typeof data.userId === "string" ? data.userId : undefined,
    login: typeof data.login === "string" ? data.login.trim().toLowerCase() : "",
    password: typeof data.password === "string" ? data.password : undefined,
    role: data.role === "owner" ? "owner" : data.role === "editor" ? "editor" : undefined,
    displayName: typeof data.displayName === "string" ? data.displayName : undefined,
    newPassword: typeof data.newPassword === "string" ? data.newPassword : undefined,
  };
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  return body as Record<string, unknown>;
}
