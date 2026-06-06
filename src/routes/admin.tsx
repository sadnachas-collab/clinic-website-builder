import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Админ-панель | VORONÉNKO" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Admin,
});

function Admin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ok">("checking");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const postInit = () => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "admin-supabase-init",
          url: "local-api",
          key: "local-api",
          access_token: "local-session",
          refresh_token: "local-session",
        },
        window.location.origin,
      );
    };

    fetch("/api/clinic/auth/session", { credentials: "include" }).then((response) => {
      if (!mounted) return;
      if (!response.ok) {
        navigate({ to: "/login", replace: true });
      } else {
        setStatus("ok");
        setTimeout(postInit, 0);
      }
    });

    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      if (!data || typeof data !== "object") return;

      if (data.type === "admin-logout") {
        fetch("/api/clinic/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
          navigate({ to: "/login", replace: true });
        });
        return;
      }

      if (data.type === "admin-iframe-ready" && iframeRef.current?.contentWindow) {
        postInit();
      }

      if (data.type === "admin-rpc-call" && iframeRef.current?.contentWindow) {
        const { requestId, action, payload } = data as {
          requestId?: string;
          action?: string;
          payload?: Record<string, unknown>;
        };
        const reply = (body: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage(
            { type: "admin-rpc-result", requestId, ...body },
            window.location.origin,
          );
        try {
          let result: unknown;
          if (action === "listAdmins") {
            result = await apiJson("/api/clinic/admins");
          } else if (action === "createAdmin") {
            result = await apiJson("/api/clinic/admins", "POST", payload);
          } else if (action === "deleteAdmin") {
            result = await apiJson(
              `/api/clinic/admins/${encodeURIComponent(String(payload?.userId || ""))}`,
              "DELETE",
            );
          } else if (action === "updateAdmin") {
            result = await apiJson(
              `/api/clinic/admins/${encodeURIComponent(String(payload?.userId || ""))}`,
              "PATCH",
              payload,
            );
          } else if (action === "changeOwnPassword") {
            result = await apiJson("/api/clinic/admins/change-password", "POST", payload);
          } else {
            throw new Error("Unknown admin RPC action: " + String(action));
          }
          reply({ ok: true, data: result });
        } catch (err) {
          reply({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      mounted = false;
      window.removeEventListener("message", onMessage);
    };
  }, [navigate]);

  if (status === "checking") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f3ee",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          color: "#888",
        }}
      >
        Проверка доступа…
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src="/clinic-admin.html"
      title="Админ-панель клиники"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
        display: "block",
      }}
    />
  );
}

async function apiJson(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error || "Ошибка запроса");
  return json;
}
