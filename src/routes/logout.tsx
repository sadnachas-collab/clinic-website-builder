import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/logout")({
  head: () => ({
    meta: [{ title: "Выход…" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LogoutPage,
});

function LogoutPage() {
  const navigate = useNavigate();
  useEffect(() => {
    fetch("/api/clinic/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
      navigate({ to: "/login", replace: true });
    });
  }, [navigate]);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        color: "#888",
        background: "#f5f3ee",
      }}
    >
      Выход…
    </div>
  );
}
