# Project state — Cashew

Last verified: **2026-11-08**  
Status: **presentation-ready offline demo**  
Stack: **Next.js 14.2.15 App Router, React 18, TypeScript 5, Tailwind 3.4**

This is the current source of truth for what exists. If a change alters a fact here, update this file in the same commit. Use [`CHANGE_MAP.md`](CHANGE_MAP.md) to jump to the owning files.

---

## 1. Product summary

Cashew verifies a single export invoice once and produces one evidence bundle. Consented lenders see the same bundle, set their own evidence weights and submit one sealed offer. The exporter compares offers by **effective annualised cost** and signs. The financed invoice is fingerprinted into a hash-chained duplicate registry and recorded in the audit log.

The demo is fully offline at runtime. External sources, OCR, timers, e-sign/OTP, notifications, tracking and anchoring are clearly staged. The matching, risk, cost, registry and passport cryptography are real computations.

---

## 2. Route map

| Route | Role | Purpose |
| --- | --- | --- |
| `/` | public | Role picker and demo framing. |
| `/app` | exporter | Dashboard, active trades, passport tier, next step. |
| `/app/trades` | exporter | Searchable trade list with All / Active / Completed filters. |
| `/app/trades/new` | exporter | Four-step wizard: details → five documents → verification → review/consent. Supports amended invoice. |
| `/app/trades/[id]` | exporter | Workspace tabs: Overview, Documents, Verification, Offers, Financing, Tracking, Activity. Accept, OTP sign, disbursal, registry receipt. |
| `/app/passport` | exporter | Signed Trade Passport, claims, browser verification, tamper tests, scoped share. |
| `/app/m` | exporter | Phone frame using the same API/state; Home, Offers, Track. |
| `/lender` | lender | Consent-scoped inbox and offer status. |
| `/lender/trades/[id]` | lender | Evidence review, weight sliders, sealed offer form, submitted offer. |
| `/lender/products` | lender | Eligibility rules, pricing defaults, fees, conditions, active toggle. |
| `/registry` | lender / ops | Chain stats, integrity banner, chain visual, entries, lookup explanation, simulated anchor. |
| `/ops` | ops | Query-string tabs: Review queue, Audit log, Source health. Duplicate decisions. |
| `/kit` | internal | Component kit reference. |
| `/api/[...path]` | all | Single catch-all API dispatcher. |

All pages are rendered dynamically; stateful pages never prerender a stale snapshot.

---

## 3. API groups

All routes are implemented in `app/api/[...path]/route.ts`, backed by `lib/store.ts`.

| Group | Endpoints |
| --- | --- |
| Session | `GET /api/orgs/me`, `POST /api/session` |
| Trades | `GET/POST /api/trades`, `GET /api/trades/:id`, `POST /api/trades/:id/documents`, `POST /api/trades/:id/verify`, `POST /api/trades/:id/flag`, `POST /api/trades/:id/offer-requests` |
| Evidence / risk / offers | `GET /api/trades/:id/evidence`, `GET /api/trades/:id/risk-profile?w=…`, `GET/POST /api/trades/:id/offers` |
| Consent | `POST /api/consents`, `POST /api/consents/:id/revoke` |
| Offer lifecycle | `POST /api/offers`, `POST /api/offers/:id/accept`, `POST /api/offers/:id/sign` |
| Lender | `GET /api/lender/inbox`, `GET /api/lender/products`, `PATCH /api/products/:id` |
| Registry | `GET /api/registry/entries`, `POST /api/registry/check`, `POST /api/registry/commit`, `GET /api/registry/verify-chain`, `POST /api/registry/anchor` |
| Passport | `GET /api/passport/:orgId`, `POST /api/passport/share` |
| Ops | `GET /api/ops/queue`, `POST /api/ops/queue/:id/decision`, `GET /api/audit`, `GET /api/notifications` |
| Demo | `GET /api/demo/state`, `GET /api/demo/scenario-trades`, `POST /api/demo/scenario`, `POST /api/demo/speed`, `POST /api/demo/reset`, `POST /api/demo/advance` |

Authorization is enforced in the route: consent is required for lender access, exporter ownership for mutations, ops-only for ops endpoints, and lender ownership for product edits. Consent windows are clamped. Passport sharing is forced to the active exporter identity.

---

## 4. Architecture

```
app/                      pages + catch-all API
components/               UI primitives, verification board, offer comparison, shell/demo chrome
lib/engines/
  crossdoc.ts             real cross-document comparison
  verification.ts         14 check definitions, fixture lines, evidence bundle
  risk.ts                 weighted evidence strength and caps
  matching.ts             eligibility, effective-cost maths, hidden fees, ranking
  registry.ts             fingerprint, hash chain, fuzzy match, Ed25519 signatures
  passport.ts             passport claims, signing and server verification
  state.ts                trade state machine and consent helpers
lib/seed/index.ts         orgs, buyers, products, history, scenarios, documents, registry
lib/store.ts              module-level persisted state and every mutation
lib/passport-client.ts    browser-side Ed25519 verification (WebCrypto → tweetnacl fallback)
tests/fixtures.test.ts    blueprint fixture regression suite
```

### State lifecycle

- `lib/store.ts` holds a module-level `StoreState`, seeded from `lib/seed/index.ts`.
- State is mirrored to `.demo-state.json` in the repository root. The mirror survives refreshes and dev-server restarts; reset replaces it with a fresh seed.
- Timed work is **lazily materialised on reads**: verification runs, lender offers, disbursal and other due timestamps are checked whenever state is read. There are no background workers.
- One catch-all API means the store and the API cannot drift into separate implementations.
- The role cookie is `cashew_role`; the active org cookie is `cashew_org`; the exporter org follows the scenario.
- Deterministic Ed25519 seed keypairs keep registry and passport signatures verifiable after a restart.

### Scenario identity

| Scenario | Exporter | Buyer | Trade seed |
| --- | --- | --- | --- |
| A | Kaveri Textiles Pvt Ltd (`org_kaveri`) | Northgate Apparel Ltd | none until wizard |
| B | Kaveri Textiles Pvt Ltd (`org_kaveri`) | Northgate Apparel Ltd | none until wizard |
| C | Coimbatore Knit Studio LLP (`org_cks`) | Hartwell & Rowe Retail Ltd | `TRD-C-001` and `TRD-C-002`, both submitted with five documents |

---

## 5. Engine contracts

### Cross-document matcher

Compares the latest document versions for PO, invoice, packing list, shipping bill and bill of lading. Checks quantity against BL/packing/SB and PO, amount integrity, shipping-bill FOB value, date ordering, party names after normalisation, HS code, ports, currency and incoterm. A permitted partial shipment below PO quantity is a **note**, not a failure.

### 14 checks

`rules-v0.1`; each check has an id, title, source, mode, duration and evidence. Checks 1–14 are:

1 Entity active · 2 IEC active · 3 Promoter identity · 4 GST · 5 e-Invoice · 6 Export documents lodged · 7 Carrier confirmation · 8 Documents agree · 9 Buyer registered/rated · 10 Sanctions · 11 Related party · 12 Registry duplicate · 13 Bank name · 14 Buyer confirmation.

Check 8 is computed. Check 12 is computed against the registry. Checks 7 and 14 depend on staged shipment/buyer actions. Everything else is a labelled simulated adapter. Unknown is never converted to pass.

### Risk strength

Component maxima: **Entity 30, Transaction 40, Buyer 20, Structure 10**. Unknown/pending receives 40% credit; failure receives 0. Blocking failures on checks 5, 8, 10 or 12 cap the band at **Limited**.

Lender weight sliders apply multipliers to those component maxima; they do not allocate percentages. The underlying check results never change.

### Offer maths

For each offer: advance = invoice value × advance %, interest = advance × rate × tenure/365, fees = explicit fee rows plus conditional fees detected in conditions. Net cash = advance − fees. Effective annualised cost = total cost / net cash × 365 / tenure. Ranking is by effective cost only. There is **no commission field**.

### Registry

```
fingerprint = SHA-256(SALT || "|" || supplierId || "|" || buyerId || "|" ||
              invoiceNo || "|" || invoiceDate || "|" || amount || "|" || currency)

entryHash   = SHA-256(prevHash + canonicalJSON(core))
```

Fuzzy match weights: invoice 0.30, amount 0.30, date 0.20, currency 0.10, IRN 0.10. At or above **0.80** is a possible duplicate (`warn`, ops case). An exact or already-financed match is a failure and blocks. Entries expose a masked lender only; lookup never reveals lender identity.

### Trade Passport

Claims: tier, entity checks, completed trades, on-time delivery, on-time repayment, total financed, track record. Signed with deterministic Ed25519 keys. Browser verification canonicalises the unsigned payload and verifies with WebCrypto, falling back to `tweetnacl`. Tampering with any claim invalidates the signature.

### State machine

`DRAFT → SUBMITTED → VERIFYING → VERIFIED → OFFERS_OPEN → OFFER_ACCEPTED → CONTRACT_SIGNED → FINANCED → SHIPPED → DELIVERED → REPAID`, with `NEEDS_INFO` and review paths. Invalid transitions are rejected; accepted/signed/disbursed actions are idempotent.

---

## 6. Fixture invariants

### Scenario B — the main story

| Fact | Value |
| --- | --- |
| Invoice | 4,800 pcs × USD 6.25 = **USD 30,000 / ₹25,50,000** |
| PL / SB / BL | 4,200 pcs |
| Shipping Bill FOB | USD 26,250 |
| Amended invoice | USD 26,250 / **₹22,31,250** |
| Check 8 failure | `Invoice quantity 4,800 does not match Bill of Lading quantity 4,200.` |
| Risk pre-amendment | **82.8 / Limited**, blocked by check 8 |
| Risk post-amendment | **92.8 / Strong**, no blocking checks |
| PO clause | Partial shipment permitted; amended invoice note is informational |

Pre-amendment arithmetic: 100 − 10 (check 8) − 3.6 (check 7 unknown) − 3.6 (check 14 pending) = 82.8.

### Offers at ₹22,31,250 / 90 days

| Lender | Structure | Effective cost |
| --- | --- | --- |
| Banyan Capital | 85% advance, 11.5% p.a., 0.5% fee | **13.53%** |
| Tidewater Finance | 90% advance, 10.2% p.a., 0.6% + ₹3,500 + 0.8% conditional FX spread | **16.58%** |
| Meridian Bank | 80% advance, 10.4% p.a., 0.25% + 0.30% ECGC | **12.93% — cheapest** |

Tidewater's conditional FX spread is surfaced as a hidden fee of **₹16,065**.

### Scenario C — duplicate attempt

| Fact | Value |
| --- | --- |
| Original financed invoice | `CKS/2627/0188`, USD 18,400, date −50 days, IRN seeded |
| Attempt 2 | `CKS/2627/0188-A`, USD 18,900 / ₹16,06,500, date +2 days |
| Similarity | **≈ 0.8766** (invoice 0.26, amount ≈0.245, date ≈0.171, currency 0.10, IRN 0.10) |
| Check 12 | `warn` (possible duplicate; trade can proceed) |
| Ops case | created with a blocking review; Confirm duplicate / Clear both require a note |
| Attempt 2 documents | internally consistent; check 8 passes and the trade verifies at 89.2% |

The attempt changes quantity to 3,024 pcs and updates PO, packing, shipping bill and BL so only the registry catches the duplicate.

### Registry seed

14 entries: 13 filler entries (mostly settled) plus Coimbatore `CKS/2627/0188` financed at position 14 (lender Banyan, USD 18,400). The first new financing becomes position 15.

### Timing at 1×

| Event | Delay |
| --- | --- |
| Check run | ≈12 s total |
| Tidewater offer | 4 s |
| Banyan offer | 8 s |
| Meridian offer | 12 s |
| Disbursal after signing | 2 s |

The demo speed control divides these durations; `max`/`instant` skips animation. All timing is computed from due timestamps, so refresh-safe.

---

## 7. Real vs staged

| Real | Staged and labelled |
| --- | --- |
| SHA-256 hashing and canonical JSON | OCR / extraction from seeded JSON |
| Cross-document comparison | MCA, IEC, PAN, GST, e-Invoice, customs, carrier, sanctions, related-party, buyer registry, penny-drop |
| 14-check runner, evidence bundle | Lender response timers |
| Risk blend and weight sliders | E-sign and OTP |
| Eligibility, effective cost, hidden fees, ranking | Notifications, shipment milestones |
| Registry chain, fuzzy matching, signatures | External anchor |
| Passport signing and browser verification | Disbursal movement |
| State machine and audit log | |

---

## 8. Validation and limitations

- `npm run check` runs typecheck, fixture tests and a production build.
- All 14 app routes build as dynamic (`ƒ`).
- The store is single-process and intended for a demo, not concurrent production use. It has no locking, migrations or database.
- The JSON mirror is a convenience, not durable storage.
- Next.js 14.2.15 is pinned for the demo and has an npm security advisory; do not expose this build publicly without upgrading.
- Scenario C is a secondary story. The primary five-minute flow is Scenario B.
- The browser verifier requires Ed25519 support or the bundled `tweetnacl` fallback.
- No real money, lender identity, buyer message, shipment or government source is contacted.
