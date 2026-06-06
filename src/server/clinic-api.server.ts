import {
  changeOwnPassword,
  clearSessionCookie,
  createAdmin,
  deleteAdmin,
  getCurrentAdmin,
  HttpError,
  listAdmins,
  loginAdmin,
  requireAdmin,
  seedFirstAdminIfEnabled,
  updateAdmin,
} from "./clinic-auth.server";
import { canRunPublicDbOperation, runDbOperation, type DbOperation } from "./clinic-db.server";
import { deleteObjects, getObjectResponse, uploadObject } from "./clinic-storage.server";

export async function handleClinicApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/clinic/")) return null;

  try {
    if (url.pathname === "/api/clinic/health") return json({ ok: true });
    if (url.pathname.startsWith("/api/clinic/auth/")) return await handleAuth(request, url);
    if (url.pathname.startsWith("/api/clinic/admins")) return await handleAdmins(request, url);
    if (url.pathname === "/api/clinic/db") return await handleDb(request);
    if (url.pathname === "/api/clinic/storage/upload") return json(await uploadObject(request));
    if (url.pathname === "/api/clinic/storage/delete") return json(await deleteObjects(request));
    if (url.pathname.startsWith("/api/clinic/storage/object/")) {
      const match = url.pathname.match(/^\/api\/clinic\/storage\/object\/([^/]+)\/(.+)$/);
      if (!match) return new Response("Not found", { status: 404 });
      return await getObjectResponse(decodeURIComponent(match[1]), decodePath(match[2]));
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status >= 500) console.error(error);
    return json({ error: message }, status);
  }
}

async function handleAuth(request: Request, url: URL) {
  if (url.pathname === "/api/clinic/auth/bootstrap" && request.method === "POST") {
    return json(await seedFirstAdminIfEnabled());
  }
  if (url.pathname === "/api/clinic/auth/login" && request.method === "POST") {
    const body = (await request.json()) as { login?: string; password?: string };
    const result = await loginAdmin(String(body.login || ""), String(body.password || ""));
    return json({ user: result.admin }, 200, { "set-cookie": result.cookie });
  }
  if (url.pathname === "/api/clinic/auth/session" && request.method === "GET") {
    const admin = await getCurrentAdmin(request);
    if (!admin) return json({ user: null }, 401);
    return json({
      user: {
        id: admin.id,
        login: admin.login,
        displayName: admin.display_name,
        role: admin.role,
      },
    });
  }
  if (url.pathname === "/api/clinic/auth/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
  }
  return json({ error: "Not found" }, 404);
}

async function handleAdmins(request: Request, url: URL) {
  if (url.pathname === "/api/clinic/admins" && request.method === "GET") {
    return json(await listAdmins(request));
  }
  if (url.pathname === "/api/clinic/admins" && request.method === "POST") {
    return json(await createAdmin(request, await request.json()));
  }
  if (url.pathname === "/api/clinic/admins/change-password" && request.method === "POST") {
    return json(await changeOwnPassword(request, await request.json()));
  }
  const id = url.pathname.match(/^\/api\/clinic\/admins\/([^/]+)$/)?.[1];
  if (id && request.method === "PATCH") {
    return json(
      await updateAdmin(request, { ...(await request.json()), userId: decodeURIComponent(id) }),
    );
  }
  if (id && request.method === "DELETE") {
    return json(await deleteAdmin(request, { userId: decodeURIComponent(id) }));
  }
  return json({ error: "Not found" }, 404);
}

async function handleDb(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const operation = (await request.json()) as DbOperation;
  const isPublicOperation = canRunPublicDbOperation(operation);
  if (!isPublicOperation) {
    await requireAdmin(request);
  } else if (operation.action === "insert" && operation.table === "requests") {
    operation.payload = pickRequestPayload(operation.payload);
  }
  const data = await runDbOperation(operation);
  return json({ data, error: null });
}

function pickRequestPayload(payload: DbOperation["payload"]) {
  const source = Array.isArray(payload) ? payload[0] : payload;
  if (!source || typeof source !== "object") return {};
  const allowed = ["name", "phone", "service", "comment", "source"];
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => allowed.includes(key)),
  ) as Record<string, unknown>;
}

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function decodePath(value: string) {
  return value
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");
}
