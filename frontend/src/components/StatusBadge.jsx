import { useTranslation } from "react-i18next";

const statusClasses = {
  submitted: "status-submitted",
  verified: "status-verified",
  in_progress: "status-in-progress",
  waiting: "status-waiting",
  blocked: "status-blocked",
  closed: "status-closed"
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const className = statusClasses[status] || "status-submitted";
  return <span className={`badge ${className}`}>{t(`status.${status}`)}</span>;
}
