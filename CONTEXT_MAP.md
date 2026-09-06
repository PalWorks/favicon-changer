# Context Map

Where knowledge lives in this repository. Start here when you do not know which file answers your
question.

---

## By question

| Question | File |
|---|---|
| What is this and how do I run it? | [README.md](README.md) |
| What are the rules I must not break? | [AGENTS.md](AGENTS.md) |
| How is it put together? Which code runs where? | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| What does "rule", "matcher", "scope" mean? Which rule wins? | [docs/DOMAIN.md](docs/DOMAIN.md) |
| Why is this code written so strangely? | [docs/DECISIONS.md](docs/DECISIONS.md) |
| How do I build, load, debug, release, roll back? | [docs/PLAYBOOK.md](docs/PLAYBOOK.md) |
| How do I test this? What must I check by hand? | [docs/TESTING.md](docs/TESTING.md) |
| A user reports the favicon didn't change | [docs/RUNBOOK.md](docs/RUNBOOK.md) |
| Is this behaviour a known bug? | [docs/LIMITATIONS.md](docs/LIMITATIONS.md) |
| What should I work on next? | [ROADMAP.md](ROADMAP.md) |
| What changed in each version? | [CHANGELOG.md](CHANGELOG.md) |
| What are the threats, permissions and CSP rules? | [docs/SECURITY.md](docs/SECURITY.md) |
| What do we tell users about their data? | [PRIVACY_POLICY.md](PRIVACY_POLICY.md) |

Table name: **docs-by-question**

---

## By code area

| Area | Code | Docs |
|---|---|---|
| Favicon application, observers, DOM | [content.ts](content.ts), [utils/faviconDom.ts](utils/faviconDom.ts), [utils/faviconObserver.ts](utils/faviconObserver.ts) | ARCHITECTURE §3, ADR-001/002/003/014, DOMAIN §5 |
| Rule matching and precedence | [utils/matcher.ts](utils/matcher.ts), [utils/matcher.test.ts](utils/matcher.test.ts) | DOMAIN §2, ROADMAP R-01/R-02/R-04 |
| Storage, migration, import/export | [utils/storage.ts](utils/storage.ts) | ARCHITECTURE §6, ADR-004/005, SECURITY threats 1 to 3 |
| Messaging and injection | [utils/messaging.ts](utils/messaging.ts) | ARCHITECTURE §5, ADR-008 |
| OS popup workaround | [background.ts](background.ts), `openExpandedEditor` in storage.ts | ARCHITECTURE §7, ADR-007, RUNBOOK "upload does nothing" |
| Editor UI | [components/FaviconEditor.tsx](components/FaviconEditor.tsx), [components/editor/](components/editor/) | ADR-010, ROADMAP R-15 |
| Icon generation, compression, MIME repair | [utils/canvas.ts](utils/canvas.ts) | DOMAIN §3 |
| Options page | [Options.tsx](Options.tsx), [components/options/](components/options/) | ARCHITECTURE §1 |
| Logging | [utils/logger.ts](utils/logger.ts) | ADR-009, RUNBOOK, SECURITY data rule 4 |
| Review prompt policy | [utils/rating.ts](utils/rating.ts), [components/RatingPrompt.tsx](components/RatingPrompt.tsx) | ADR-015, ROADMAP R-47 |
| Build | [vite.config.ts](vite.config.ts), [vite.content.config.ts](vite.content.config.ts) | ARCHITECTURE §2, ADR-006 |
| Manifest, permissions, CSP | [public/manifest.json](public/manifest.json) | SECURITY |
| Types and tuning constants | [types.ts](types.ts), [constants.ts](constants.ts) | DOMAIN §1 |

Table name: **docs-by-code-area**

---

## Layout

```
README.md              orientation
AGENTS.md              agent + contributor contract  <- read before editing
CONTEXT_MAP.md         this file
ROADMAP.md             the only work queue
CHANGELOG.md           release history
PRIVACY_POLICY.md      user-facing, published; changes are a listing change too

docs/
  ARCHITECTURE.md      contexts, build, data flow, storage, message protocol
  DOMAIN.md            entities, match precedence, vocabulary, invariants
  DECISIONS.md         ADR-001..011: why, and what breaks if reversed
  PLAYBOOK.md          setup, commands, load unpacked, release, rollback
  TESTING.md           strategy, conventions, the manual checklist
  RUNBOOK.md           user-report triage
  SECURITY.md          threat model, CSP, permissions, data handling
  LIMITATIONS.md       L-01..L-28 known defects, incl. verified dead-code inventory

.github/               Dependabot config only, no workflows (ADR-012)
store-assets/          Chrome Web Store listing images
agent_docs_guide.md    the general guide this doc set was structured from
```

Not tracked in git: `dist/` (build output), `node_modules/`, `*.zip` (release archives).

---

## Conventions used across these docs

- **`L-xx`** identifies a known defect, described in `docs/LIMITATIONS.md`.
- **`R-xx`** identifies a queued piece of work, planned in `ROADMAP.md`.
- **`ADR-xxx`** identifies a decision record in `docs/DECISIONS.md`.
- Each `L-xx` points to its `R-xx`; each `R-xx` points back to the `L-xx` it resolves.
- Every markdown table is given a name so it can be referred to in review.
- One tracker only. New findings go to `ROADMAP.md` + `docs/LIMITATIONS.md`, never a new file.
