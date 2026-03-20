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

By default the client calls `http://localhost:8000` (see `src/services/glassesApi.ts`). For production, point that base URL at your deployed **`mf_backend`** instance and ensure CORS allows your web origin.

## Env (optional)

If you add `.env` / `VITE_*` variables, keep them out of git (see `.gitignore`).
