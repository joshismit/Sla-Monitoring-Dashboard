# SLA Monitoring Dashboard

A comprehensive, full-stack monitoring dashboard built to ingest, aggregate, and visualize service health checks and SLA performance.

## Architecture

This project is built using a modern Next.js stack with a Serverless backend and PostgreSQL for robust persistence:

- **Frontend**: Next.js 15 (App Router) with React 19, Tailwind CSS v4, and custom responsive layouts.
- **Backend**: Next.js API Routes (`/api/upload`, `/api/stats`, `/api/logs`) acting as serverless endpoints.
- **Database**: PostgreSQL hosted on Neon, managed via Prisma ORM.
- **Ingestion Pipeline**: A streaming CSV parser (`papaparse`) directly inside the API route that streams records straight to PostgreSQL.

The core architecture follows this flow:
```text
                  Vercel
        ┌───────────────────────┐
        │ Next.js Dashboard     │
        │                       │
        │ React UI              │
        │ /api/upload           │
        │ /api/stats            │
        │ /api/logs             │
        └───────────┬───────────┘
                    │
                    │ Prisma
                    ▼
             ┌──────────────┐
             │    Neon      │
             │ PostgreSQL   │
             └──────────────┘
```

By offloading calculations and data processing to the backend serverless functions, the React UI remains lightweight, purely focusing on state management, filtering, and data visualization.

---

## Data Quality Handling & Normalization

The ingestion pipeline (`lib/pipeline`) explicitly handles real-world dirty data by applying strict validation and normalization rules:

1. **Timestamp Normalization**: The dataset contained mixed timestamp formats (ISO strings, Unix timestamps, standard Date strings). All timestamps are strictly parsed and converted to **UTC ISO-8601** strings before persisting to the DB.
2. **Latency Normalization**: Latency units were mixed (`ms` and `s`). All latencies are detected, parsed, and converted to milliseconds (`ms`) integers. 
3. **Missing/Invalid Latencies**: If a latency is missing (empty), it is retained as `NULL` (acceptable for timeout failures). If a latency is negatively signed (e.g. `-100`), the entire row is rejected as invalid.
4. **Status Validation**: Valid HTTP statuses are expected. Specifically, the dummy/internal status `999` is rejected completely as anomalous data.
5. **Billing Credits**: Calculating SLA billing credits requires specific contractual formulas (e.g., tier-based reimbursement) which weren't specified. Therefore, it is intentionally omitted from this implementation.

---

## Availability & SLA Calculation

The overall and per-service availability calculations are handled purely at the database level using PostgreSQL aggregations (`/api/stats`), preventing browser memory issues on large datasets.

**Definition of Availability**: 
- A check is considered **Available** (successful) if its HTTP Status Code is strictly in the `2xx` or `3xx` range (e.g. `200` to `399`).
- A check is considered **Failed** (unavailable) if its HTTP Status Code is `4xx`, `5xx`, or if it times out without a status.

**Formula**: 
`Availability % = ((Total Checks - Failed Checks) / Total Checks) * 100`

---

## Duplicate Upload Strategy

Uploading the same CSV twice (or files with overlapping data) is a common occurrence. This is strictly mitigated using an idempotent database design:

- **Compound Unique Key**: The Prisma schema defines a unique constraint (`@@unique`) across four fields: `[timestampUtc, serviceName, agent, region]`. 
- Multiple agents probing the same service at the exact same timestamp are considered **independent, valid observations**, which is why `agent` and `region` are included in the unique constraint.
- **Skip Duplicates**: During the ingestion phase, we use Prisma's `createMany({ skipDuplicates: true })`. This guarantees that if existing observations are re-uploaded, the database silently ignores them without throwing an error and without double-counting the statistics.

---

## Getting Started

### Local Execution

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Setup your Environment Variables. Create a `.env` file in the root:
   ```env
   DATABASE_URL="postgresql://user:password@host.neon.tech/neondb?sslmode=require"
   ```

3. Run Prisma Migrations to initialize the DB schema:
   ```bash
   npx prisma migrate dev --name init
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The dashboard will be available at [http://localhost:3000](http://localhost:3000).

5. Run the Test Suite:
   ```bash
   npm run test
   ```

### Production Deployment

1. Run the production build locally to verify:
   ```bash
   npm run build
   ```
2. Deploy the Next.js app to Vercel.
3. Ensure the `DATABASE_URL` environment variable is securely added to the Vercel project settings.
4. (Optional) Run `npx prisma db push` or add a post-build step for database migrations in the CI/CD pipeline.

---

## Future Improvements

If granted more time, I would consider adding the following features:

1. **Background Job Processing**: Currently, ingestion happens synchronously in the `/api/upload` route. For massive files (100MB+), this could hit serverless execution time limits (e.g., 10 seconds on Vercel Hobby). Moving ingestion to a true background queue (like Inngest or Upstash) with a WebSocket progress bar would scale better.
2. **Time-Series Database**: While PostgreSQL works great, migrating the actual log data to a specialized TSDB (like TimescaleDB or ClickHouse) would dramatically speed up the aggregations when row counts reach the millions.
3. **Advanced Visualizations**: Implementing sparklines, heatmaps for regional latencies, and an interactive timeseries chart (e.g., using Recharts or Chart.js) to view uptime trends over the month.
4. **Authentication**: Wrapping the dashboard in NextAuth.js or Clerk to protect sensitive metrics.
