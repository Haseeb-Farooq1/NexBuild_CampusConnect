# CampusConnect

Campus event registration project for the NexBuild web development assignment.

## Current MVP

- Responsive event discovery page
- Search and category filters
- Available seat and fully booked states
- Database-backed student registration and cancellation
- Protected organizer dashboard with event totals and seat progress
- Neon PostgreSQL API with cookie sessions and atomic seat checks

## Run the project

```bash
npm install
npm run dev
```

Open https://nex-build-campus-connect.vercel.app/.


## Database setup

Create the tables in Neon using the SQL schema supplied for this project, then add your Neon connection string to `.env`:

```bash
DATABASE_URL="your-neon-connection-string"
```

The API is implemented in `src/app/api`. It uses the unique event/user registration key and a PostgreSQL advisory transaction lock when checking capacity, so two students cannot claim the last seat at the same time.

## Demo accounts

- Student: `bscs001@pu.edu.pk` / `student123`
- Organizer: `organizer@campus.edu` / `campus123`
