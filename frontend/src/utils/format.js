import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function formatDate(value) {
  if (!value) return "-";
  try {
    return format(parseISO(value), "yyyy-MM-dd HH:mm");
  } catch (_error) {
    return String(value);
  }
}

export function formatDateShort(value) {
  if (!value) return "-";
  try {
    return format(parseISO(value), "yyyy-MM-dd");
  } catch (_error) {
    return String(value);
  }
}

export function formatAgo(value) {
  if (!value) return "-";
  try {
    return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
  } catch (_error) {
    return String(value);
  }
}
