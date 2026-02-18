import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getTickets } from "../api/tickets";
import { getProjects } from "../api/projects";
import StatusBadge from "../components/StatusBadge";
import PriorityBadge from "../components/PriorityBadge";
import { CATEGORY_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import { formatDateShort } from "../utils/format";

const SORT_OPTIONS = ["created_at", "updated_at", "priority"];

function priorityWeight(priority) {
  return { critical: 0, high: 1, normal: 2, low: 3 }[priority] ?? 99;
}

export default function MyTicketsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("updated_at");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const [projectRows, ticketRows] = await Promise.all([getProjects(), getTickets({ my: "1" })]);
        if (!active) return;
        setProjects(projectRows);
        setTickets(ticketRows);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const filteredTickets = useMemo(() => {
    let rows = [...tickets];

    if (status) rows = rows.filter((ticket) => ticket.status === status);
    if (category) rows = rows.filter((ticket) => ticket.category === category);
    if (projectId) rows = rows.filter((ticket) => ticket.project_id === projectId);

    if (dateFrom) {
      rows = rows.filter((ticket) => String(ticket.created_at).slice(0, 10) >= dateFrom);
    }

    if (dateTo) {
      rows = rows.filter((ticket) => String(ticket.created_at).slice(0, 10) <= dateTo);
    }

    if (sortBy === "priority") {
      rows.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
    } else {
      rows.sort((a, b) => String(b[sortBy]).localeCompare(String(a[sortBy])));
    }

    return rows;
  }, [tickets, status, category, projectId, dateFrom, dateTo, sortBy]);

  return (
    <section className="page-content">
      <header className="page-header">
        <h1>{t("tickets.myTitle")}</h1>
      </header>

      <article className="card form-grid filters-grid">
        <h2>{t("tickets.filters")}</h2>
        <label>
          {t("tickets.status")}
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">-</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.category")}
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">-</option>
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`category.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.project")}
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">-</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.dateFrom")}
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>

        <label>
          {t("tickets.dateTo")}
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>

        <label>
          {t("tickets.sortBy")}
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            {SORT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`tickets.${value === "created_at" ? "createdAt" : value === "updated_at" ? "updatedAt" : "priority"}`)}
              </option>
            ))}
          </select>
        </label>
      </article>

      <article className="card table-wrap">
        {loading ? <p>{t("app.loading")}</p> : null}
        {!loading && filteredTickets.length === 0 ? <p>{t("tickets.noTickets")}</p> : null}

        {!loading && filteredTickets.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("tickets.titleField")}</th>
                <th>{t("tickets.project")}</th>
                <th>{t("tickets.category")}</th>
                <th>{t("tickets.priority")}</th>
                <th>{t("tickets.status")}</th>
                <th>{t("tickets.createdAt")}</th>
                <th>{t("tickets.plannedDate")}</th>
                <th>{t("tickets.updatedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>#{String(ticket.number).padStart(3, "0")}</td>
                  <td>
                    <Link to={`/ticket/${ticket.id}`}>{ticket.title}</Link>
                  </td>
                  <td>
                    {projects.find((project) => project.id === ticket.project_id)?.name || "-"}
                  </td>
                  <td>{t(`category.${ticket.category}`)}</td>
                  <td><PriorityBadge priority={ticket.priority} /></td>
                  <td><StatusBadge status={ticket.status} /></td>
                  <td>{formatDateShort(ticket.created_at)}</td>
                  <td>{formatDateShort(ticket.planned_date)}</td>
                  <td>{formatDateShort(ticket.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </section>
  );
}
