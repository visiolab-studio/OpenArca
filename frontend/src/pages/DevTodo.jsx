import { useTranslation } from "react-i18next";

export default function DevTodoPage() {
  const { t } = useTranslation();

  return (
    <section className="page-content">
      <article className="card">
        <h1>{t("nav.todo")}</h1>
        <p>{t("dev.todoPlaceholder")}</p>
      </article>
    </section>
  );
}
