import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <iframe
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
