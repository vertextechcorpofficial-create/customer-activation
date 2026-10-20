# Customer Activation

Feature modules live here. Keep each feature self-contained, mirroring the layout used by the
other subsystems:

```
src/modules/customer-activation/<feature>/
├─ components/   UI for the feature
├─ hooks/        client state and data fetching
├─ services/     server-side access to Directus / the Spring API
├─ types/        zod schemas and inferred types
└─ utils/        pure helpers
```

Routes that back a feature go under `src/app/api/customer-activation/<feature>/`, and its page
under `src/app/(customer-activation)/customer-activation/<feature>/`.
