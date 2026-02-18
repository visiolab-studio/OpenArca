import { useTranslation } from "react-i18next";

const priorityClasses = {
  critical: "priority-critical",
  high: "priority-high",
  normal: "priority-normal",
  low: "priority-low"
};

export default function PriorityBadge({ priority }) {
  const { t } = useTranslation();
  const className = priorityClasses[priority] || "priority-normal";
  return <span className={`badge ${className}`}>{t(`priority.${priority}`)}</span>;
}
