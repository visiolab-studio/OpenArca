import { MessageSquareMore } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function getSupportThreadPath(threadId, isDeveloper) {
  if (!threadId) return null;
  return isDeveloper ? `/support-threads/${threadId}` : `/quick-support/${threadId}`;
}

export default function SupportThreadOriginBadge({
  threadId,
  isDeveloper,
  className = "",
  interactive = true
}) {
  const { t } = useTranslation();
  const to = getSupportThreadPath(threadId, isDeveloper);

  if (!to) {
    return null;
  }

  const classes = `${interactive ? "support-thread-origin-link" : "support-thread-origin-badge"} ${className}`.trim();
  const content = (
    <>
      <MessageSquareMore size={12} />
      <span>{t("tickets.quickSupportOrigin")}</span>
    </>
  );

  if (!interactive) {
    return (
      <span className={classes} title={t("tickets.quickSupportOriginLong")}>
        {content}
      </span>
    );
  }

  return (
    <Link className={classes} to={to} title={t("tickets.quickSupportOriginLong")}>
      {content}
    </Link>
  );
}
