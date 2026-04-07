import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export const enterpriseBaseItems = [];
export const enterpriseNavSections = [];
export const enterpriseRoutes = [];

function statusLabel(status) {
  if (status === "open") return "Otwarte";
  if (status === "pending") return "Oczekujące";
  if (status === "closed") return "Zamknięte";
  return status || "-";
}

async function readJson(response) {
  return response.json();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  return readJson(response);
}

function MessageList({ messages = [], userRole = "developer" }) {
  return (
    <div className="support-thread-message-list">
      {messages.map((message) => {
        const isRequester = message.author?.role === "user";
        const roleBadge = isRequester ? (userRole === "user" ? "Ty" : "Requester") : "Support";
        return (
          <article
            key={message.id}
            className={`support-thread-message-card ${isRequester ? "is-requester" : "is-support"}`}
          >
            <div className="support-thread-message-head">
              <div>
                <strong>{message.author?.name || message.author?.email}</strong>
                <p className="muted support-thread-message-meta-line">{message.author?.email}</p>
              </div>
              <div className="row-actions">
                <span className="badge badge-no-dot">{roleBadge}</span>
              </div>
            </div>
            <p className="support-thread-message-content">{message.content}</p>
          </article>
        );
      })}
    </div>
  );
}

function ConvertedNotice({ ticketId }) {
  return (
    <>
      <article className="card support-thread-notice support-thread-notice-converted">
        <h2 className="card-title">Przekonwertowany wątek</h2>
        <p className="muted">Ten wątek został już eskalowany do pełnego zgłoszenia.</p>
        <p className="muted support-thread-form-hint">
          Po konwersji ten wątek jest tylko do odczytu. Dalszą pracę kontynuuj na podlinkowanym zgłoszeniu.
        </p>
        <Link className="btn btn-primary support-thread-ticket-link-inline" to={`/ticket/${ticketId}`}>
          Otwórz zgłoszenie
        </Link>
      </article>
      <article className="card support-thread-action-card support-thread-convert-card support-thread-converted-card">
        <h2 className="card-title">Przekonwertowany wątek</h2>
        <p className="muted">Ten wątek został już eskalowany do pełnego zgłoszenia.</p>
        <p className="muted support-thread-form-hint">
          Po konwersji ten wątek jest tylko do odczytu. Dalszą pracę kontynuuj na podlinkowanym zgłoszeniu.
        </p>
        <Link className="btn btn-primary support-thread-ticket-link" to={`/ticket/${ticketId}`}>
          Otwórz zgłoszenie
        </Link>
      </article>
    </>
  );
}

export function SupportThreadsInboxPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (scope) params.set("scope", scope);
    if (query) params.set("q", query);
    fetchJson(`http://localhost:4000/api/enterprise/support-threads?${params.toString()}`).then(setItems);
  }, [status, scope, query]);

  return (
    <section className="page-content support-threads-page">
      <article className="card">
        <h2 className="card-title">Widoczne wątki</h2>
        <label>
          <span>Szukaj po tytule, zgłaszającym lub treści wiadomości</span>
          <input aria-label="Szukaj po tytule, zgłaszającym lub treści wiadomości" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          <span>Status</span>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Wszystkie</option>
            <option value="open">Otwarte</option>
            <option value="pending">Oczekujące</option>
            <option value="closed">Zamknięte</option>
          </select>
        </label>
        <label>
          <span>Zakres</span>
          <select aria-label="Zakres" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">Wszystkie</option>
            <option value="mine">Moje</option>
            <option value="unassigned">Nieprzypisane</option>
          </select>
        </label>
        {items.length === 0 ? (
          <p>Brak wątków supportowych dla wybranych filtrów.</p>
        ) : (
          <ul className="list-plain">
            {items.map((item) => (
              <li key={item.id}>
                <article className="support-thread-row">
                  <div>
                    <Link to={`/support-threads/${item.id}`}>{item.title}</Link>
                    <div className="row-actions">
                      {item.project?.name ? <span>{item.project.name}</span> : null}
                      {item.converted_ticket_id ? <span className="badge badge-no-dot">Przekonwertowany</span> : null}
                    </div>
                  </div>
                  {item.converted_ticket_id ? <Link to={`/ticket/${item.converted_ticket_id}`}>Otwórz zgłoszenie</Link> : null}
                </article>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

export function SupportThreadDetailPage() {
  const { id } = useParams();
  const [thread, setThread] = useState(null);
  const [users, setUsers] = useState([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState("");
  const [reply, setReply] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchJson(`http://localhost:4000/api/enterprise/support-threads/${id}`).then((data) => {
      setThread(data);
      setAssigneeId(data.assignee_id || "");
      setStatus(data.status || "open");
    });
    fetchJson("http://localhost:4000/api/users").then(setUsers).catch(() => setUsers([]));
  }, [id]);

  if (!thread) return null;

  const saveWorkflow = async () => {
    const updated = await fetchJson(`http://localhost:4000/api/enterprise/support-threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee_id: assigneeId || null, status })
    });
    setThread(updated);
    setMessage("Zmiany zapisane.");
  };

  const sendReply = async () => {
    const updated = await fetchJson(`http://localhost:4000/api/enterprise/support-threads/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply })
    });
    setThread(updated);
    setReply("");
    setMessage("Odpowiedź wysłana.");
  };

  const convertThread = async () => {
    const result = await fetchJson(`http://localhost:4000/api/enterprise/support-threads/${id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category })
    });
    setThread(result.thread);
    setMessage("Wątek supportowy został przekonwertowany do zgłoszenia.");
  };

  return (
    <section className="page-content support-thread-detail-page">
      {thread.converted_ticket_id ? <ConvertedNotice ticketId={thread.converted_ticket_id} /> : null}
      <article className="card">
        <h1>{thread.title}</h1>
        {message ? <p>{message}</p> : null}
        {thread.assignee?.email ? <p>{thread.assignee.email}</p> : null}
        {thread.project?.name ? <p>{thread.project.name}</p> : null}
      </article>
      <section className="support-thread-detail-grid">
        <article className="card">
          <h2 className="card-title">Konwersacja</h2>
          <MessageList messages={thread.messages} userRole="developer" />
        </article>
        <div>
          {thread.converted_ticket_id ? null : (
            <article className="card">
              <h2 className="card-title">Workflow</h2>
              <label>
                <span>Przypisany</span>
                <select aria-label="Przypisany" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Brak</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.email}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="open">Otwarte</option>
                  <option value="pending">Oczekujące</option>
                  <option value="closed">Zamknięte</option>
                </select>
              </label>
              <button type="button" onClick={saveWorkflow}>Zapisz zmiany</button>
            </article>
          )}
          {thread.converted_ticket_id ? null : (
            <article className="card">
              <h2 className="card-title">Odpowiedź</h2>
              <label>
                <span>Odpowiedź</span>
                <textarea aria-label="Odpowiedź" value={reply} onChange={(e) => setReply(e.target.value)} />
              </label>
              <button type="button" onClick={sendReply}>Wyślij odpowiedź</button>
            </article>
          )}
          {thread.converted_ticket_id ? null : (
            <article className="card">
              <h2 className="card-title">Konwertuj do zgłoszenia</h2>
              <label>
                <span>Kategoria</span>
                <select aria-label="Kategoria" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Wybierz</option>
                  <option value="question">Pytanie</option>
                </select>
              </label>
              <button type="button" onClick={convertThread}>Konwertuj do zgłoszenia</button>
            </article>
          )}
        </div>
      </section>
    </section>
  );
}

export function SupportThreadsUserInboxPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    fetchJson(`http://localhost:4000/api/enterprise/support-threads?${params.toString()}`).then(setItems);
  }, [status]);

  return (
    <section className="page-content support-threads-page">
      <article className="card">
        <Link to="/quick-support/new">Nowy wątek</Link>
        <label>
          <span>Status</span>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Wszystkie</option>
            <option value="open">Otwarte</option>
            <option value="closed">Zamknięte</option>
          </select>
        </label>
        <ul className="list-plain">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/quick-support/${item.id}`}>{item.title}</Link>
              {item.project?.name ? <span>{item.project.name}</span> : null}
              {item.converted_ticket_id ? <Link to={`/ticket/${item.converted_ticket_id}`}>Otwórz zgłoszenie</Link> : null}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

export function SupportThreadUserNewPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("normal");

  useEffect(() => {
    fetchJson("http://localhost:4000/api/projects").then(setProjects);
  }, []);

  const submit = async () => {
    const created = await fetchJson("http://localhost:4000/api/enterprise/support-threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, project_id: projectId || null, priority })
    });
    navigate(`/quick-support/${created.id}`);
  };

  return (
    <section className="page-content support-thread-new-page">
      <article className="card">
        <h1>Nowy wątek supportowy</h1>
        <input
          placeholder="Np. Jaki rozmiar grafiki mamy używać dla tła profilu autora?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Opisz pytanie albo niewielką akcję, której potrzebujesz od supportu."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Bez projektu</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="normal">Normalny</option>
          <option value="high">Wysoki</option>
        </select>
        <button type="button" onClick={submit}>Utwórz wątek</button>
      </article>
    </section>
  );
}

export function SupportThreadUserDetailPage() {
  const { id } = useParams();
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchJson(`http://localhost:4000/api/enterprise/support-threads/${id}`).then(setThread);
  }, [id]);

  const statusText = useMemo(() => statusLabel(thread?.status), [thread?.status]);

  if (!thread) return null;

  const sendReply = async () => {
    const updated = await fetchJson(`http://localhost:4000/api/enterprise/support-threads/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply })
    });
    setThread(updated);
    setReply("");
    setMessage("Wiadomość wysłana.");
  };

  return (
    <section className="page-content support-thread-detail-page">
      {thread.converted_ticket_id ? <ConvertedNotice ticketId={thread.converted_ticket_id} /> : null}
      <article className="card">
        <h1>{thread.title}</h1>
        <p>{statusText}</p>
        {message ? <p>{message}</p> : null}
      </article>
      <section className="support-thread-detail-grid support-thread-detail-grid-user">
        <article className="card">
          <h2 className="card-title">Konwersacja</h2>
          <MessageList messages={thread.messages} userRole="user" />
        </article>
        <div className="support-thread-side-column">
          {thread.converted_ticket_id ? null : (
            <article className="card">
              <h2 className="card-title">Doprecyzowanie</h2>
              <textarea
                placeholder="Napisz doprecyzowanie albo kolejne pytanie."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <button type="button" onClick={sendReply}>Wyślij wiadomość</button>
            </article>
          )}
        </div>
      </section>
    </section>
  );
}

export default {
  enterpriseBaseItems,
  enterpriseNavSections,
  enterpriseRoutes,
  SupportThreadsInboxPage,
  SupportThreadDetailPage,
  SupportThreadsUserInboxPage,
  SupportThreadUserNewPage,
  SupportThreadUserDetailPage
};
