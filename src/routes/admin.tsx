import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdmins,
  createAdmin,
  deleteAdmin,
  changeOwnPassword,
} from "@/lib/admins.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Админ-панель | VORONÉNKO" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ok">("checking");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/login", replace: true });
      } else {
        setStatus("ok");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) navigate({ to: "/login", replace: true });
      // При обновлении токена пересылаем новую сессию в iframe
      if (session && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "admin-supabase-init",
            url: import.meta.env.VITE_SUPABASE_URL,
            key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          },
          window.location.origin,
        );
      }
    });

    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      if (!data || typeof data !== "object") return;

      if (data.type === "admin-logout") {
        supabase.auth.signOut().finally(() => {
          navigate({ to: "/login", replace: true });
        });
        return;
      }

      if (data.type === "admin-iframe-ready" && iframeRef.current?.contentWindow) {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return;
        iframeRef.current.contentWindow.postMessage(
          {
            type: "admin-supabase-init",
            url: import.meta.env.VITE_SUPABASE_URL,
            key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            access_token: s.session.access_token,
            refresh_token: s.session.refresh_token,
          },
          window.location.origin,
        );
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
            result = await listAdmins();
          } else if (action === "createAdmin") {
            result = await createAdmin({ data: payload as never });
          } else if (action === "deleteAdmin") {
            result = await deleteAdmin({ data: payload as never });
          } else if (action === "changeOwnPassword") {
            result = await changeOwnPassword({ data: payload as never });
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
      subscription.unsubscribe();
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
