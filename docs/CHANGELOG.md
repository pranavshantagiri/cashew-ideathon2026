# Changelog

Every meaningful change goes here. Use `Unreleased` while work is in progress, then date it on release. User-visible effect first; file details only where they help future work.

## Unreleased

_No pending changes._

## 2026-11-08 — Runtime QA + documentation system

### Added

- Documentation system so future changes can be handled from targeted docs instead of rereading the repo: `AGENTS.md`, `README.md`, `docs/PROJECT_STATE.md`, `docs/CHANGE_MAP.md`, `docs/MILESTONES.md`, `docs/DECISIONS.md`, `docs/QA.md`, this changelog.
- `npm run typecheck` and `npm run check` (`typecheck` + fixture tests + production build).

### Fixed

- **Ops decisions failed with “Case not found.”** The API read the path segment `decision` instead of the case id. Confirm duplicate and Clear now close the case, store the required note and write the audit event.
- **Stale polling could overwrite fresh data.** `useApi` now ignores responses from a previous path, fixing the passport briefly showing the lender’s empty credential and similar role-switch races.
- **Shell showed the previous role/org while switching areas.** Navigation, role label and org label now follow the current route immediately instead of waiting for the next session poll.
- **Review step kept the pre-amendment invoice value.** Uploading the amended invoice now updates the review value to USD 26,250 / ₹22,31,250.
- **Scenario C attempt 2 had an unrelated check-8 failure.** Its PO quantity is now updated with its packing/BL/SB so the only issue is the registry duplicate. The altered trade now carries the correct ₹16,06,500 value.
- **Scenario C documents named the wrong seller.** PO, invoice, packing list and BL now use Coimbatore Knit Studio LLP. Check 13 reflects the actual seller, and check 5 exposes the actual scenario IRN.

### Changed

- `package.json` description corrected to “Cashew — verified export finance demo”; scripts added as above.
- Fixture suite extended to guard Scenario C consistency and dynamic check 5/13 evidence.

### Verified

- Browser walkthrough of Scenario B and C, both ops decision paths, passport tamper/restore, registry, lender review, products, source health, mobile frame, persistence and reset.
- `npm run check` passes.

## 2026-11-03 — Full presentation demo

### Added

- Offline Next.js 14 App Router application with bundled Fraunces, Inter and IBM Plex Mono fonts.
- Real engines:
  - canonical JSON + SHA-256 hashing;
  - cross-document matcher;
  - 14-check runner and evidence bundle;
  - weighted risk profile with component maxima 30/40/20/10 and blocking caps;
  - effective-cost offer maths, hidden-fee detection and ranking;
  - SHA-256 hash-chained duplicate registry with fuzzy match and Ed25519 signatures;
  - Trade Passport signing and in-browser verification;
  - trade state machine and audit log.
- Seeded Scenarios A, B and C; three lender products; buyer/org data; 14-entry registry; deterministic demo keys.
- Exporter dashboard, four-step wizard, workspace tabs, offer comparison, accept/OTP/sign/disbursal and registry receipt.
- Lender inbox, evidence review, weight sliders, sealed offer form, product rules.
- Ops queue, decisions, audit log and source health.
- Registry page with chain visual, verification and simulated anchor.
- Passport page with browser verification, three tamper tests, restore, download and scoped share.
- Mobile frame using the same API state.
- Demo panel, presenter notes, keyboard shortcuts, reset and refresh-safe JSON mirror.
- Fixture regression suite covering the blueprint's exact strings and values.
