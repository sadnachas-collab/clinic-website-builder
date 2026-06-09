import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/clinic-site.html", replace: true });
  },
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
  return null;
}
