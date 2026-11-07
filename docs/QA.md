# QA — automated checks and run-of-show

Use this file for regression runs. Update it whenever a flow, fixture or expected result changes.

## 1. Automated gate

```bash
npm run check      # typecheck → fixture tests → production build
```

Expected:

- `tsc --noEmit` reports no errors.
- Vitest passes the fixture suite in `tests/fixtures.test.ts`.
- Next builds all routes; `/api/[...path]` and every stateful page are dynamic.
- No build warning about missing fonts, remote assets or environment variables.

For a narrower loop while editing:

```bash
npm run typecheck
npm test
```

## 2. Start clean

```bash
npm run dev
```

Open `http://localhost:3000`. Use **Reset demo** in the demo panel, or press **Shift+R**, before a recorded run. Reset should complete in under a second, set Scenario A, restore the 14-entry registry and clear the active wizard/trade.

Keyboard shortcuts (ignored while typing in an input, textarea or select):

| Key | Action |
| --- | --- |
| `D` | Toggle the demo panel |
| `N` | Next presenter note |
| `1` / `2` / `3` | Load Scenario A / B / C |
| `Shift+R` | Reset the demo |
| `Esc` | Close the demo panel |

## 3. Five-minute run-of-show — Scenario B

1. Press `2` (or open the demo panel → Scenario B). The app navigates to `/app`.
2. Open **New trade** and choose the Scenario B sample.
3. Walk the four steps. On the document step, let the staged scan finish. Each slot must say the extraction is simulated while the SHA-256 hash is real.
4. Run verification. The board must show 14 checks; check 8 must fail with exactly:
   `Invoice quantity 4,800 does not match Bill of Lading quantity 4,200.`
5. Confirm the risk banner shows **82.8 / Limited** and check 8 is blocking.
6. Upload the **amended invoice**. The review value must become **USD 26,250 / ₹22,31,250**. Verify again.
7. Check 8 now passes. Risk must be **92.8 / Strong**. The partial-shipment note is informational.
8. Give consent and open the trade to the three seeded lenders.
9. Use **Release lender offers** (or wait at 1×). Offers must appear in this effective-cost order:
   - Meridian **12.93%** — cheapest
   - Banyan **13.53%**
   - Tidewater **16.58%** — includes the detected conditional FX spread of **₹16,065**
10. Accept **Meridian**. Enter any valid demo OTP. Sign. Disbursal is staged and completes after the timer.
11. The trade moves to **Financed**. The registry receipt must show a new position (15 on a clean seed). The passport must gain the completed trade and Tier 2 / 3.
12. Open **Trade Passport**. Browser verification must say **Verified** and name the method (WebCrypto or tweetnacl fallback).
13. Press **Add ₹5L** (or the equivalent tamper test). Verification must become **Invalid** with a signature error. Press **Restore** and confirm **Verified** again.

Pass criteria: exact strings and numbers above, no console error, no network request other than the local app, and all simulated surfaces visibly labelled.

## 4. Scenario C — duplicate attempt

1. Press `3` to load Scenario C. The exporter is **Coimbatore Knit Studio LLP**.
2. Open the pre-seeded **attempt 2** trade (`TRD-C-002`, `CKS/2627/0188-A`).
3. Confirm the value is **USD 18,900 / ₹16,06,500**.
4. Verification must show **89.2% / Strong**; check 8 passes and check 12 is **warn** with similarity **≈ 0.8766**.
5. The duplicate case must appear in **Ops → Review queue**.
6. Open the case and try **Confirm duplicate** and **Clear** with a note. Both paths must close the case, record the decision and add an audit event.
7. Confirm check 13 names **COIMBATORE KNIT STUDIO LLP** and check 5 exposes the scenario IRN.
8. Try the **exact duplicate** path if available: the original invoice `CKS/2627/0188` must fail check 12 and block.

## 5. Lender and ops surfaces

- `/lender`: only consented, open trades appear; accepted trades are not offerable.
- `/lender/trades/[id]`: evidence is read-only; sliders change the weighted strength only; the same failing checks remain failing. Submit one sealed offer and confirm the preview maths matches the stored offer.
- `/lender/products`: edit eligibility/pricing, save, reload; values must persist for the demo session.
- `/ops`: Review queue, Audit log and Source health tabs load. Audit entries are append-only.
- `/registry`: header shows the current chain length and a green integrity banner. Verify chain succeeds; tamper detection is covered by the fixture suite. Anchor is labelled simulated.
- `/app/m`: phone frame renders and reads the same trade state.

## 6. Persistence and reset

1. Complete the Scenario B financing.
2. Refresh the browser. Trade status, offers, registry entry and ops decisions must remain.
3. Restart the dev server. The same state must restore from `.demo-state.json`; passport and registry signatures must still verify.
4. Reset. The seeded 14-entry registry, Scenario A, offers and queue must return; no stale trade survives.

## 7. Role and polling checks

- Navigate directly to `/ops`, `/lender` and `/app`. The shell role label and org identity must match the route immediately, before the next session poll.
- Switch exporter → lender → ops quickly while a request is in flight. A stale response must not render another role’s data (for example, the lender’s empty passport on the exporter passport page).
- Confirm no request loop or duplicate toast appears when polling.

## 8. Failure checklist

If a check fails:

1. Fix the owning engine or page using `docs/CHANGE_MAP.md`; do not edit fixtures ad hoc.
2. Add or update a fixture test for the broken invariant.
3. Re-run `npm run check`.
4. Add a `CHANGELOG.md` entry and update `PROJECT_STATE.md` if the contract changed.
