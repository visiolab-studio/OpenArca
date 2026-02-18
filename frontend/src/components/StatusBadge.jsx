import { useTranslation } from "react-i18next";

const statusClasses = {
  submitted: "badge-submitted",
  verified: "badge-verified",
  in_progress: "badge-in_progress",
  waiting: "badge-waiting",
  blocked: "badge-blocked",
  closed: "badge-closed"
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const className = statusClasses[status] || "badge-submitted";
  return <span className={`badge ${className}`}>{t(`status.${status}`)}</span>;
}
