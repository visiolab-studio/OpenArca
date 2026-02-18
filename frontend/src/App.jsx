import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function App() {
  const [health, setHealth] = useState({ status: "loading" });

  useEffect(() => {
    async function checkHealth() {
      try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        setHealth({ status: "ok", data });
      } catch (error) {
        setHealth({ status: "error", message: error.message });
      }
    }

    checkHealth();
  }, []);

  return (
    <main className="app-shell">
      <section className="panel">
        <h1>EdudoroIT_SupportCenter</h1>
        <p>Bootstrap frontend is running.</p>
        <p>
          API URL: <code>{API_URL}</code>
        </p>
        <pre>{JSON.stringify(health, null, 2)}</pre>
      </section>
    </main>
  );
}
