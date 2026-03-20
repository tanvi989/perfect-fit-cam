# perfect-fit-cam

React + Vite + TypeScript virtual try-on / face capture UI: glasses handling, landmark capture, PD and eyewear insights.

**Live (example):** [perfect-fit-cam.vercel.app](https://perfect-fit-cam.vercel.app/)

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## API URL

Production builds use **`https://vtob.multifolks.com`** (see `src/services/glassesApi.ts`). For local backend, add **`.env.local`** with `VITE_API_BASE_URL=http://localhost:8000`. Ensure the API allows your web origin in CORS.

## Env (optional)

If you add `.env` / `VITE_*` variables, keep them out of git (see `.gitignore`).
