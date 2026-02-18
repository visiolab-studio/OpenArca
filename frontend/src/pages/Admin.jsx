import { useTranslation } from "react-i18next";

export default function AdminPage() {
  const { t } = useTranslation();

  return (
    <section className="page-content">
      <article className="card">
        <h1>{t("nav.admin")}</h1>
        <p>{t("dev.adminPlaceholder")}</p>
      </article>
    </section>
  );
}
