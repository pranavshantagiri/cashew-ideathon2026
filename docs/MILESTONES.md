# Milestones

Status key: **Done** · **In progress** · **Planned** · **Out of scope**

| Milestone | Status | Completed | Acceptance evidence |
| --- | --- | --- | --- |
| M0 — Repository and offline scaffold | Done | 2026-11-03 | Next 14 + TS + Tailwind build, bundled fonts, no runtime network, `.gitignore`, scripts. |
| M1 — Domain model and real engines | Done | 2026-11-03 | Canonical hashing, cross-document matcher, 14-check runner, risk engine, offer maths, registry chain/fuzzy match, passport signing, state machine. |
| M2 — Exporter flow | Done | 2026-11-04 | Landing, dashboard, wizard, document staging, amended invoice, verification board, open to lenders, offers, accept, OTP sign, disbursal, registry receipt, trade list, activity. |
| M3 — Lender flow | Done | 2026-11-05 | Consent-scoped inbox, evidence review, weight sliders, sealed offer form with fee disclosure and live effective-cost preview, product rules. |
| M4 — Ops and shared registry | Done | 2026-11-05 | Duplicate queue with Confirm/Clear decisions and notes, audit log, source health, 14-entry chain, integrity verification, registry page, simulated anchor. |
| M5 — Passport and mobile frame | Done | 2026-11-06 | Ed25519 passport, browser verification with method label, three tamper tests, scoped share, phone frame using the same API. |
| M6 — Fixture and build hardening | Done | 2026-11-07 | Exact check 8, risk 82.8/92.8, offers 13.53/16.58/12.93, hidden fee, Scenario C ≈0.877, chain tamper, passport tamper, fixed FX. Typecheck/build/test pass. |
| M7 — Runtime QA and documentation system | Done | 2026-11-08 | Full browser walkthrough of B and C, ops decisions both paths, passport tamper/restore, lender/registry/ops surfaces, reset/persistence. Fixed stale polling, role chrome, ops decision id, amended review value and Scenario C consistency. Added this docs system and `npm run check`. |

## M7 acceptance detail

Verified in the running app:

- Scenario B: 82.8 Limited pre-amendment; exact check 8 line; amended invoice gives 92.8 Strong and value ₹22,31,250.
- Offers: Meridian 12.93%, Banyan 13.53%, Tidewater 16.58% with hidden ₹16,065; Meridian selected.
- Accept → OTP → sign → disbursal → registry position 15 and receipt.
- Scenario C attempt 2: 89.2% Strong, check 12 warn at 0.8766, check 8 passes, trade verifies.
- Ops: Clear path and Confirm duplicate path both close cases with notes and audit events.
- Passport: Tier 2 / 3 completed trades; tampering `totalFinanced` invalidates the signature; restore works.
- Shell: role and org label update immediately by route; no stale lender/ops identity.
- Persistence: a full page load keeps financed trade, registry entry, offers and ops decisions.
- API error on ops decision (`case not found`) fixed; stale polling response race fixed.

## Remaining / optional

| Item | Status | Note |
| --- | --- | --- |
| Automated browser E2E | Planned | Current regression is fixture tests plus manual QA. Add Playwright only if the demo becomes a longer-lived product. |
| Anchor to a real external service | Out of scope | The anchor button is explicitly simulated. |
| Real OCR, live data adapters, auth, database | Out of scope | Blueprint deliberately excludes them. |
| Next.js security upgrade | Planned | 14.2.15 is pinned for the demo; upgrade before any public deployment. |

## Definition of done for future milestones

A milestone is done only when:

1. The path is usable end-to-end in the relevant role.
2. `npm run check` passes.
3. Fixture invariants are covered by tests or explicitly exempted.
4. `CHANGELOG.md` has a dated entry.
5. `PROJECT_STATE.md` reflects any route, API, engine, fixture or limitation change.
