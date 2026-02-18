import { useTranslation } from "react-i18next";

export default function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <main className="page page-center">
      <div className="card">{t("app.loading")}</div>
    </main>
  );
}
