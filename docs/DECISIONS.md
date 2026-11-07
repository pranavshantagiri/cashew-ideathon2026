# Decisions (short ADRs)

These explain the non-obvious choices. Read only the ones relevant to the change.

## ADR-001 — Single Next.js app with one catch-all API

**Decision:** One App Router project and one `app/api/[...path]/route.ts` dispatcher, backed by `lib/store.ts`.  
**Why:** The demo must run offline from one command and must not drift between “engine code” and “API code”. A single process also makes the in-memory demo state and JSON mirror simple.  
**Trade-off:** No horizontal scaling, no per-route code splitting, one file to touch for API changes.

## ADR-002 — Module-level store, lazily materialised

**Decision:** Keep state in a module-level object, mirror it to `.demo-state.json`, and check due timestamps on every read.  
**Why:** It survives refreshes and dev restarts without a database. Timed checks/offers/disbursal stay deterministic and refresh-safe without workers.  
**Trade-off:** Single-process only; no locking; not production storage.

## ADR-003 — Real engines, staged adapters

**Decision:** Hashing, cross-document rules, risk, offer maths, registry and passport cryptography are real. External data, OCR, timers, e-sign and tracking are staged and labelled.  
**Why:** The presentation is about a neutral verification/comparison layer, not about pretending to integrate with government systems.  
**Rule:** Never silently convert a staged or unknown result into a pass.

## ADR-004 — Hand-rolled UI primitives, bundled fonts

**Decision:** Build accessible buttons, chips, drawers, modals and cards in `components/`; bundle fonts with `@fontsource`.  
**Why:** Avoid a network/CLI dependency and keep the app fully offline while matching the blueprint's visual language.  
**Rule:** Do not add a component library or CDN asset without an explicit decision.

## ADR-005 — Fixed demo FX and fixture arithmetic

**Decision:** Use one constant `FX = 85` and exact fixture numbers.  
**Why:** The run-of-show depends on stable values (₹22,31,250, 82.8/92.8, 13.53/16.58/12.93, ≈0.877).  
**Rule:** Any fixture change must update `tests/fixtures.test.ts`, `docs/PROJECT_STATE.md` and this documentation system.

## ADR-006 — Risk weights are multipliers, not allocations

**Decision:** Lender sliders multiply component maxima (30/40/20/10); the underlying check results are immutable.  
**Why:** It demonstrates “your view of the same evidence” without letting a lender change what happened. The weighted blend is recomputed server-side.  
**Rule:** Sliders must never imply that a failing check can be weighted away; blocking caps still apply.

## ADR-007 — Sealed offers, no commission, effective cost only

**Decision:** One offer per lender per trade; offers are sealed; ranking is by effective annualised cost; there is no commission field.  
**Why:** The product's neutrality claim depends on it. Hidden conditional fees are surfaced to the exporter.  
**Rule:** Do not add a commission, placement fee or sponsored ranking without an explicit product change.

## ADR-008 — Deterministic demo identities and keys

**Decision:** Scenario identity follows the scenario (Kaveri for A/B, Coimbatore for C); Ed25519 demo keys are derived from fixed seeds.  
**Why:** Persisted registry entries and passports must still verify after a restart, and the demo must be reproducible on any machine.  
**Rule:** Never make signing depend on random keys generated at boot.

## ADR-009 — Scenario C is internally consistent

**Decision:** The altered duplicate attempt updates PO, packing, SB and BL quantities and carries the correct value, leaving the registry as the only signal.  
**Why:** The duplicate story should be the reason the trade is held, not an unrelated document mismatch. The similarity remains ≈0.877 because the fingerprint uses invoice number/date/amount.  
**Rule:** Do not reintroduce a check-8 failure in Scenario C unless the run-of-show explicitly needs two defects.
