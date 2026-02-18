import { useTranslation } from "react-i18next";

export default function BoardPage() {
  const { t } = useTranslation();

  return (
    <section className="page-content">
      <article className="card">
        <h1>{t("nav.board")}</h1>
        <p>{t("dev.boardPlaceholder")}</p>
      </article>
    </section>
  );
}
