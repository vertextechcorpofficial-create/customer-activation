# Customer Activation

Next.js subsystem shell for **Customer Activation**, cloned from the Project Management subsystem
with the PM business module removed. Auth, theming, the sidebar shell, the subsystem launcher and
the shared UI primitives are intact; add features under `src/modules/customer-activation/`.

## Layout

| Path | Purpose |
| --- | --- |
| `src/app/(customer-activation)/` | Authenticated subsystem routes (sidebar shell) |
| `src/app/(public)/` | Login, password reset, marketing pages |
| `src/app/main-dashboard/` | Subsystem launcher, driven by the Directus `subsystems` registry |
| `src/app/api/auth/`, `api/shared/`, `api/announcements/`, `api/pdf/` | Shared backend proxies |
| `src/app/api/customer-activation/app-sidebar/` | Sidebar navigation + current-user proxies |
| `src/modules/customer-activation/` | **Feature modules go here** |
| `src/components/ui/` | shadcn primitives (generated) |

## Getting started

```bash
npm install
npm run dev
```

`.env` requires `NEXT_PUBLIC_API_BASE_URL`, `DIRECTUS_STATIC_TOKEN`, and `SPRING_API_BASE_URL`
(all three already present in the copied `.env`).

## Checks

```bash
npm run typecheck
npx eslint . --max-warnings=0
```

Sidebar entries are not defined in code — they come from the Directus `modules` table filtered by
the subsystem slug `customer-activation`, so the subsystem needs a row in `subsystems` and its
modules registered there before navigation renders.
