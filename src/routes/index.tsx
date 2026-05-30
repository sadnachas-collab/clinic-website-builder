import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Клиника косметологии Доктора Вороненко | VORONÉNKO" },
      {
        name: "description",
        content:
          "Клиника косметологии в Самаре. Инъекционная, аппаратная и эстетическая косметология. Запись на приём онлайн.",
      },
      { property: "og:title", content: "Клиника косметологии Доктора Вороненко" },
      {
        property: "og:description",
        content:
          "Клиника косметологии в Самаре. Инъекционная, аппаратная и эстетическая косметология.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/clinic-site.html"
      title="Клиника косметологии Доктора Вороненко"
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
