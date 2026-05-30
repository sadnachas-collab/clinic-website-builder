import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { seedFirstAdminIfNeeded } from "@/lib/admins.functions";

const EMAIL_DOMAIN = "clinic.local";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Вход в админ-панель | VORONÉNKO" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(true);

  useEffect(() => {
    // Идемпотентный сид первого админа admin/123456
    seedFirstAdminIfNeeded()
      .catch((e) => console.error("seed failed", e))
      .finally(() => setSeeding(false));

    // Если уже залогинен — сразу в админку
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const email = `${login.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInErr) {
      setError("Неверный логин или пароль");
      return;
    }
    navigate({ to: "/admin" });
  }

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Вход в админ-панель</h1>
        <p style={styles.subtitle}>Клиника косметологии Доктора Вороненко</p>

        <label style={styles.label}>
          Логин
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            autoFocus
            autoComplete="username"
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={styles.input}
          />
        </label>

        {error && <div style={styles.error}>{error}</div>}

        <button
          type="submit"
          disabled={loading || seeding}
          style={{
            ...styles.button,
            opacity: loading || seeding ? 0.6 : 1,
            cursor: loading || seeding ? "wait" : "pointer",
          }}
        >
          {loading ? "Вход…" : "Войти"}
        </button>

        <div style={styles.hint}>
          Первый вход: <code>admin</code> / <code>123456</code>
          <br />
          После входа смените пароль в разделе «Сотрудники».
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f5f3ee 0%, #e8e4dd 100%)",
    padding: 20,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "#fff",
    borderRadius: 16,
    padding: 32,
    boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: "#1a1a1a",
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: "#888",
    marginBottom: 8,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    color: "#555",
    fontWeight: 500,
  },
  input: {
    padding: "10px 14px",
    fontSize: 15,
    border: "1px solid #ddd",
    borderRadius: 8,
    outline: "none",
    transition: "border-color 0.15s",
  },
  button: {
    marginTop: 8,
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    background: "#1a1a1a",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  error: {
    padding: "10px 12px",
    background: "#fef2f2",
    color: "#dc2626",
    borderRadius: 8,
    fontSize: 13,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    color: "#999",
    lineHeight: 1.5,
    textAlign: "center",
  },
};
