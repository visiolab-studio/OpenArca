import { useTranslation } from "react-i18next";

const priorityClasses = {
  critical: "badge-critical",
  high: "badge-high",
  normal: "badge-normal",
  low: "badge-low"
};

export default function PriorityBadge({ priority }) {
  const { t } = useTranslation();
  const className = priorityClasses[priority] || "badge-normal";
  return <span className={`badge ${className}`}>{t(`priority.${priority}`)}</span>;
}
