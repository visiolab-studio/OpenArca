import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="page page-center">
      <section className="card">
        <h1>404</h1>
        <p>Not found</p>
        <Link className="btn" to="/">
          Go home
        </Link>
      </section>
    </main>
  );
}
