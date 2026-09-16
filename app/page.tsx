export default function HomePage() {
  return (
    <main className="home-root">
      <div className="home-card">
        {/* Icon */}
        <div className="home-icon" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
            <path d="M12 8v4l3 3" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="home-title">SLA Monitoring Dashboard</h1>

        {/* Subtitle */}
        <p className="home-subtitle">
          Monitor service availability,
          <br />
          health checks and SLA performance.
        </p>

        {/* CTA */}
        <a href="/upload" className="home-cta" id="upload-csv-btn">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload CSV
        </a>

        {/* Phase note */}
        <p className="home-phase-note">Phase 1 scaffold — full dashboard coming in Phase 5</p>
      </div>
    </main>
  );
}
