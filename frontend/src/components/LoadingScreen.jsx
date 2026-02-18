import { useTranslation } from "react-i18next";

export default function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="skeleton" style={{ height: 18, width: "50%", marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 14, width: "80%", marginBottom: 8 }} />
        <p className="muted">{t("app.loading")}</p>
      </div>
    </main>
  );
}
