# Change map — where to look first

Use this index to turn a change request into a short file list. Open the **primary** files first; only widen the search if the change crosses a boundary. After editing, update the docs listed in the last column.

## Exporter experience

| If the request is about… | Primary files | Also check | Docs to update |
| --- | --- | --- | --- |
| Landing / role picker | `app/page.tsx` | `components/Shell.tsx`, `app/globals.css` | `CHANGELOG.md` |
| Dashboard cards, empty states, next step | `app/app/page.tsx` | `lib/format.ts`, `components/StatCard.tsx` | `CHANGELOG.md` |
| Trade list, search, filters | `app/app/trades/page.tsx` | `lib/format.ts`, `components/StatusChip.tsx` | `CHANGELOG.md` |
| New-trade wizard, sample selection, scan staging | `app/app/trades/new/page.tsx` | `components/DocSlot.tsx`, `components/Stepper.tsx`, `/api/trades/:id/documents` | `PROJECT_STATE.md` if flow changes |
| Amended invoice | `app/app/trades/new/page.tsx`, `lib/store.ts` (`addDocument`) | `lib/seed/index.ts` (`makeDoc` v2), check 8 engine | `PROJECT_STATE.md` fixture table |
| Trade workspace tabs / status | `app/app/trades/[id]/page.tsx` | `lib/engines/state.ts`, `components/VerificationBoard.tsx`, `components/OfferComparison.tsx` | `CHANGELOG.md` |
| Accept / OTP / disbursal / registry receipt | `app/app/trades/[id]/page.tsx`, `lib/store.ts` (`acceptOffer`, `signOffer`, `materialize`) | `app/api/[...path]/route.ts` offer routes | `PROJECT_STATE.md` state machine |
| Mobile frame | `app/app/m/page.tsx` | shared API + `lib/format.ts` | `CHANGELOG.md` |
| Passport card or tamper demo | `app/app/passport/page.tsx`, `lib/passport-client.ts` | `lib/engines/passport.ts`, `lib/store.ts` (`passportFor`) | `PROJECT_STATE.md` passport section |
| Passport share | `app/app/passport/page.tsx`, `app/api/[...path]/route.ts` (`passport/share`) | consent model in `lib/types.ts` | `CHANGELOG.md` |

## Lenders

| If the request is about… | Primary files | Also check | Docs to update |
| --- | --- | --- | --- |
| Lender inbox / consent scoping | `app/lender/page.tsx`, `app/api/[...path]/route.ts` (`lender/inbox`) | `lib/engines/state.ts` (`canLenderView`) | `CHANGELOG.md` |
| Lender trade review | `app/lender/trades/[id]/page.tsx` | `components/VerificationBoard.tsx`, `components/HashPill.tsx` | `CHANGELOG.md` |
| Evidence weight sliders | `app/lender/trades/[id]/page.tsx`, `app/api/[...path]/route.ts` (`risk-profile`) | `lib/engines/risk.ts` | `PROJECT_STATE.md` risk contract |
| Sealed offer form / fee rows / preview | `app/lender/trades/[id]/page.tsx`, `app/api/[...path]/route.ts` (`offers` POST) | `lib/engines/matching.ts`, `lib/store.ts` (`createLenderOffer`) | `PROJECT_STATE.md` offer maths |
| Product eligibility / defaults | `app/lender/products/page.tsx`, `app/api/[...path]/route.ts` (`products/:id`) | `lib/seed/index.ts` (`LENDER_PRODUCTS`) | `CHANGELOG.md` |
| Lender switcher | `components/Shell.tsx` (`switchLender`) | `app/api/[...path]/route.ts` (`session`) | `CHANGELOG.md` |

## Ops, registry and audit

| If the request is about… | Primary files | Also check | Docs to update |
| --- | --- | --- | --- |
| Ops queue / decisions / tabs | `app/ops/page.tsx`, `app/api/[...path]/route.ts` (`ops/queue/*`) | `lib/store.ts` (`addOpsCase`, `opsDecision`) | `CHANGELOG.md` |
| Audit log display or events | `app/ops/page.tsx`, `lib/store.ts` (`audit`) | every mutation that calls `audit` | `CHANGELOG.md` |
| Source health cards | `app/ops/page.tsx` | `lib/seed/index.ts` source definitions | `PROJECT_STATE.md` real-vs-staged table |
| Registry page / chain visual | `app/registry/page.tsx` | `lib/engines/registry.ts` | `PROJECT_STATE.md` registry formula |
| Registry check / fuzzy match | `lib/engines/registry.ts`, `lib/store.ts` (`registryCheck`) | `lib/engines/verification.ts` check 12 | `PROJECT_STATE.md` Scenario C |
| Registry commit / chain integrity | `lib/store.ts` (`commitToRegistry`, `materialize`), `lib/engines/registry.ts` | `/api/registry/commit`, `/verify-chain` | `PROJECT_STATE.md` |
| Anchor action | `app/registry/page.tsx`, `app/api/[...path]/route.ts` (`registry/anchor`) | `lib/store.ts` (`setAnchor`) | `CHANGELOG.md` |

## Engines

| If the request is about… | Primary files | Also check | Docs to update |
| --- | --- | --- | --- |
| Exact check text or evidence payload | `lib/engines/verification.ts` | `tests/fixtures.test.ts` | `PROJECT_STATE.md` fixture table |
| Cross-document rules | `lib/engines/crossdoc.ts` | `tests/fixtures.test.ts`, `lib/engines/verification.ts` | `PROJECT_STATE.md` |
| Risk score / band / blocking | `lib/engines/risk.ts` | `tests/fixtures.test.ts`, lender sliders | `PROJECT_STATE.md` risk contract |
| Eligibility | `lib/engines/matching.ts` (`checkEligibility`) | `lib/seed/index.ts` products | `CHANGELOG.md` |
| Effective cost / hidden fees / ranking | `lib/engines/matching.ts` | `tests/fixtures.test.ts`, `components/OfferComparison.tsx` | `PROJECT_STATE.md` offer maths |
| Trade state machine / consent | `lib/engines/state.ts` | `lib/store.ts`, API guards | `PROJECT_STATE.md` state machine |
| Passport signing / claims | `lib/engines/passport.ts` | `lib/passport-client.ts`, `app/app/passport/page.tsx` | `PROJECT_STATE.md` passport |
| Hash / canonical JSON | `lib/hash.ts` | registry and passport use both | `CHANGELOG.md` |

## Platform and demo chrome

| If the request is about… | Primary files | Also check | Docs to update |
| --- | --- | --- | --- |
| Design tokens, colours, typography | `app/globals.css`, `tailwind.config.ts` | `app/layout.tsx`, font imports | `CHANGELOG.md` |
| Offline fonts | `app/layout.tsx`, `package.json` | `@fontsource/*` imports | `PROJECT_STATE.md` constraints |
| Shell, navigation, role switcher | `components/Shell.tsx` | `app/globals.css` | `CHANGELOG.md` |
| Demo panel, speed, scenarios | `components/DemoPanel.tsx`, `/api/demo/*` | `lib/store.ts` (`setScenario`, `setSpeed`, `reset`) | `CHANGELOG.md` |
| Presenter notes / ribbon | `components/DemoRibbon.tsx` | `lib/seed/index.ts` note text | `CHANGELOG.md` |
| Keyboard shortcuts | `components/DemoPanel.tsx` | `components/DemoRibbon.tsx` | `CHANGELOG.md` |
| Toasts | `components/Toaster.tsx`, `lib/client.ts` (`toast`) | per-page calls | `CHANGELOG.md` |
| API client / polling / refresh | `lib/client.ts` | `components/Shell.tsx`, pages using `useApi` | `CHANGELOG.md` if semantics change |
| Persistence / reset / materialisation | `lib/store.ts` | `.demo-state.json`, `/api/demo/*` | `PROJECT_STATE.md` state lifecycle |
| Seed data / fixture arithmetic | `lib/seed/index.ts` | `tests/fixtures.test.ts` | `PROJECT_STATE.md` fixture table |
| Auth / consent enforcement | `app/api/[...path]/route.ts` (`ctx`, guards) | `lib/engines/state.ts` | `PROJECT_STATE.md` API groups |
| Build, scripts, test config | `package.json`, `next.config.js`, `tsconfig.json`, `vitest.config.ts` | `tests/` | `README.md`, `QA.md` |

## Cross-cutting rule

If a change affects a **fixture value**, **visible exact string**, **route**, **API shape**, **state transition** or **real-vs-staged boundary**, update `docs/PROJECT_STATE.md` and `docs/CHANGELOG.md` in the same change. If it changes what "done" means, update `docs/MILESTONES.md` too.
