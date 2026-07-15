# Medical Consultation Backend

NestJS backend base for symptom analysis, emergency triage, specialty recommendation, and doctor recommendation.

## Setup

```bash
npm install
npm run db:generate
npm run start:dev
```

The API uses the global prefix `/api/v1`.

## Environment

Copy `.env.example` to `.env` and adjust values when needed.

```env
PORT=3000
AI_SERVICE_URL=http://localhost:5678
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/medical_consultation?schema=public
```

Doctor location recommendations use Vietnamese administrative address matching
to prioritize doctors in the same ward, district, or city as the user's saved
address. This does not require an external maps API.
The local seed data in `prisma/data/vietnam-admin-units-v1.json` is based on
Province Open API v1 administrative units with 63 provinces/cities.

## Database

Start PostgreSQL with Docker:

```bash
docker compose up -d
npm run db:migrate -- --name init
npm run db:seed
```

Useful commands:

```bash
npm run db:studio
npm run db:push
```

## Auth Endpoints

All routes use the `/api/v1` prefix.

```text
POST  /api/v1/auth/register
POST  /api/v1/auth/login
GET   /api/v1/auth/me
PATCH /api/v1/auth/change-password
POST  /api/v1/auth/forgot-password
POST  /api/v1/auth/reset-password
POST  /api/v1/auth/refresh
POST  /api/v1/auth/logout
```

`/auth/me` and `/auth/change-password` require:

```text
Authorization: Bearer <accessToken>
```

Password reset OTP is sent through SMTP when configured. In development, if SMTP
is empty, the OTP is printed in the server log.

Register/login return an `accessToken` in the JSON response. The refresh token is
stored in an HttpOnly cookie and rotated through `/auth/refresh`.
