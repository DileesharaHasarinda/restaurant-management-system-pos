import './index.css';

export default function App() {
  return (
    <main className="operations-page">
      <section className="operations-panel">
        <span className="badge">
          PHASE 1 READY
        </span>

        <h1>
          Restaurant Operations
        </h1>

        <p>
          Owner, Admin and Waiter
          management application.
        </p>

        <div className="role-grid">
          <article>
            <strong>
              Owner
            </strong>

            <span>
              Dashboard & Reports
            </span>
          </article>

          <article>
            <strong>
              Admin
            </strong>

            <span>
              Restaurant Management
            </span>
          </article>

          <article>
            <strong>
              Waiter
            </strong>

            <span>
              Table Ordering
            </span>
          </article>
        </div>
      </section>
    </main>
  );
}