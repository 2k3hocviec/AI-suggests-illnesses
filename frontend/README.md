# Medical Consultation Frontend

Next.js frontend for HealthAI Portal.

## Setup

```bash
npm install
npm run dev
```

The login page is available at:

```text
http://localhost:3000/login
```

If the NestJS backend also runs on port 3000, start this app on another port:

```bash
npm run dev -- -p 3001
```

## Environment

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```
