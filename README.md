# Cashew

**One verified trade. Many lenders.**

Cashew is a presentation-grade, fully offline demo of a neutral export-finance verification layer for Indian MSME exporters. It verifies one export invoice once, shares the evidence with consented lenders, and compares sealed offers by **effective annualised cost** — never by commission.

Built as a single Next.js 14 App Router application. No runtime network calls, no CDN, no analytics and no external database.

## Start here

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # typecheck + fixture tests + production build
```

The demo opens on a role picker. Use the **Demo controls** (`D`) to load Scenario A, B or C, change speed, release lender offers, confirm the buyer, advance shipment or reset.

## Documentation map

| Document | What it is for |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | **Read first when changing the project.** Change protocol, invariants and definition of done. |
| [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) | Current source of truth: architecture, routes, engines, fixtures, persistence and limitations. |
| [`docs/CHANGE_MAP.md`](docs/CHANGE_MAP.md) | Feature-to-file index so a change request can target the right files instead of rereading the repo. |
| [`docs/MILESTONES.md`](docs/MILESTONES.md) | Completed and remaining milestones with acceptance evidence. |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Chronological record of every meaningful change. Update this with every change. |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why the demo is built the way it is (short ADRs). |
| [`docs/QA.md`](docs/QA.md) | Automated checks and the manual five-minute run-of-show. |

## The five-minute story

1. **Exporter** opens Scenario B and uploads five documents. Extraction is explicitly staged; hashing and storage are real.
2. **Fourteen checks** run. Check 8 reports the exact fixture line:
   `Invoice quantity 4,800 does not match Bill of Lading quantity 4,200.`
3. The exporter uploads the amended invoice. Check 8 passes, value becomes **₹22,31,250**, strength moves **82.8 Limited → 92.8 Strong**.
4. The trade is opened to lenders with consent. Three sealed offers arrive and are normalised:
   - Banyan — **13.53%**
   - Tidewater — **16.58%** (including a conditional FX spread surfaced as a hidden fee)
   - Meridian — **12.93%** (cheapest)
5. The exporter accepts Meridian, signs with a simulated OTP, and a staged disbursal commits the invoice to the hash-chained duplicate registry.
6. **Lenders** review the same evidence bundle, tune component weights, and submit one sealed offer.
7. **Ops** work the duplicate case, inspect source health and read the append-only audit trail.
8. The **Trade Passport** is verified in the browser with Ed25519. Any altered claim invalidates the signature.

## What is real vs staged

| Real engine | Staged / simulated |
| --- | --- |
| SHA-256 document hashing | OCR and field extraction |
| Cross-document comparison | MCA, IEC, PAN, GST, e-Invoice, customs, carrier, sanctions, buyer registry, penny-drop |
| 14-check runner and risk blend | Lender response timers |
| Effective-cost maths and hidden-fee detection | E-sign / OTP |
| Hash-chained duplicate registry and fuzzy match | Notifications and shipment tracking |
| Ed25519 passport signing and browser verification | Registry anchoring |
| Trade state machine and audit log | Disbursal timing |

Every simulated surface is labelled **simulated** or **staged** in the interface.

## Hard constraints

- Offline at runtime: fonts are bundled via `@fontsource`; no CDN, analytics or live APIs.
- Fixed FX: **USD 1 = ₹85.00**.
- No commission field exists anywhere. Offers rank by effective cost only.
- The exact fixture strings and values are guarded by tests in `tests/fixtures.test.ts`.
- State persists to `.demo-state.json` and resets in under a second.

## Repository shape

```
app/                 routes, API catch-all, shell pages
components/          reusable UI and demo chrome
lib/engines/         real verification, registry, matching, risk, state, passport
lib/seed/            deterministic scenarios, documents, products, history
lib/store.ts         persisted module store and all mutations
tests/               blueprint fixture tests
docs/                project state, change map, milestones, changelog, decisions, QA
```

## Non-goals

Real authentication, live data APIs, a production database, ML, blockchain, multi-currency, Flutter, admin onboarding, email and broad i18n are intentionally out of scope.
