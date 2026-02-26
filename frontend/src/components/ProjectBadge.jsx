import { useTranslation } from "react-i18next";
import defaultProjectIcon from "../assets/project-default.svg";

export default function ProjectBadge({
  name,
  color,
  iconUrl,
  className = "",
  showEmpty = false
}) {
  const { t } = useTranslation();
  const label = String(name || "").trim();

  if (!label) {
    if (!showEmpty) {
      return null;
    }
    return <span className={`project-badge project-badge-empty ${className}`.trim()}>{t("tickets.projectNone")}</span>;
  }

  const badgeStyle = color
    ? {
        borderColor: `${color}66`,
        boxShadow: `inset 0 0 0 1px ${color}1A`
      }
    : undefined;

  return (
    <span className={`project-badge ${className}`.trim()} style={badgeStyle} title={label}>
      <img src={iconUrl || defaultProjectIcon} alt="" aria-hidden="true" className="project-badge-icon" />
      <span className="project-badge-label">{label}</span>
    </span>
  );
}
