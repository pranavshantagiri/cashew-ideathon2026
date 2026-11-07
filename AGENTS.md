# AGENTS.md — how to change Cashew safely

This file is the entry point for any future change. **Read it before editing.** The goal is to let a change request be handled from the documentation and a few targeted files rather than rereading the whole repository.

## Read in this order

1. [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — what currently exists and what must stay true.
2. [`docs/CHANGE_MAP.md`](docs/CHANGE_MAP.md) — find the files that own the requested behaviour.
3. [`docs/DECISIONS.md`](docs/DECISIONS.md) — only the ADRs relevant to the area being changed.
4. Open only the primary/secondary files listed by the change map, plus their tests.

Do not scan or rewrite unrelated files. Keep the diff small and local.

## Required change protocol

For **every** change, including a copy tweak:

1. **Locate** the owning area in `docs/CHANGE_MAP.md`. If the map is wrong, fix the map in the same change.
2. **Edit** the smallest set of files. Preserve existing naming, formatting and component patterns.
3. **Protect fixtures.** If the change touches a fixture value or visible fixture line, update the matching test and the fixture tables in `docs/PROJECT_STATE.md`.
4. **Record the change** in [`docs/CHANGELOG.md`](docs/CHANGELOG.md) under `Unreleased` (or a dated release). State the user-visible effect, not a file-by-file diary.
5. **Update status** in [`docs/MILESTONES.md`](docs/MILESTONES.md) only when a milestone or acceptance criterion changes.
6. **Update state** in [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) whenever routes, APIs, invariants, engines, persistence, scenario data or limitations change.
7. **Run the checks**:
   ```bash
   npm run check      # typecheck + fixture tests + production build
   ```
   For UI-only changes, also run `npm run dev` and follow the relevant part of `docs/QA.md`.
8. **Report** what changed, what was verified, and any remaining caveat.

A change is not done until the docs and checks reflect it.

## Non-negotiable invariants

These are demo promises. Do not change them without an explicit product decision and a documented fixture update.

- **Offline runtime.** No CDN, analytics, external fonts, live API calls or runtime network dependency.
- **Fixed FX.** `USD 1 = ₹85.00` everywhere. Use `FX` from the seed module.
- **No commission.** There is no commission field, calculation, sort key or copy anywhere.
- **Ranking** is by effective annualised cost, then only secondary display signals.
- **Scenario B check 8 line** remains exactly:
  `Invoice quantity 4,800 does not match Bill of Lading quantity 4,200.`
- **Scenario B values**: USD 30,000 / ₹25,50,000 pre-amendment; USD 26,250 / ₹22,31,250 post-amendment.
- **Risk fixtures**: 82.8 / Limited pre-amendment, 92.8 / Strong post-amendment. Component maxima are 30 / 40 / 20 / 10.
- **Offer fixtures**: 13.53% Banyan, 16.58% Tidewater, 12.93% Meridian; Meridian cheapest.
- **Tidewater hidden fee**: conditional FX spread detected and shown; fixture amount ₹16,065.
- **Scenario C attempt 2**: invoice `CKS/2627/0188-A`, value USD 18,900 / ₹16,06,500, registry similarity ≈ 0.877, check 12 is `warn`.
- **Real vs staged**, the 14-check evidence bundle and the audit log remain visible and truthful.

## Architecture rules of thumb

- Real computation belongs in `lib/engines/`; orchestration and persistence belong in `lib/store.ts`.
- All API routes live in the single catch-all at `app/api/[...path]/route.ts`. Enforce role and consent there.
- Server state is module-level and mirrored to `.demo-state.json`. Timed work is materialised lazily on reads; do not add background workers.
- Deterministic key material and seeded timestamps keep the demo reproducible after restart.
- UI primitives are hand-rolled. Do not introduce a component framework or network-dependent package.
- Any new simulated data source must say `simulated` and must be listed in `docs/PROJECT_STATE.md`.

## Definition of done

- The requested behaviour works from the relevant role.
- `npm run check` passes.
- The offline, fixed-FX and no-commission rules still hold.
- `docs/CHANGELOG.md` has an entry.
- `docs/PROJECT_STATE.md`, `docs/CHANGE_MAP.md` or `docs/MILESTONES.md` are updated if their facts changed.
