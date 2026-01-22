# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Enterprise Architecture (ArchiMate + C4) Repo Operating System

This repo is the **single source of truth** for Enterprise Architecture requirements, decisions, and diagrams.
Everything is **file-based** so agents (and humans) can **read, diff, review, and write** architecture as code.

## Non-negotiable principles

1. **File-first**: no "architecture in someone's head" or trapped in screenshots.
2. **Git is governance**: branches/PRs/commits are the change-control system.
3. **Text diagrams only**: Mermaid / PlantUML / Structurizr DSL. No binary diagrams as the source of truth.
4. **Traceability**: every architecture element must trace back to a requirement (REQ), and every significant change must have an RFC + ADR.
5. **Two-level modeling**:
   - **C4** for software architecture (Context/Container/Component/Code).
   - **ArchiMate** for enterprise viewpoints (Capability, Value, Application, Tech, Motivation).
6. **Views are derived**: canonical model definitions are text; rendered images are build artifacts.
7. **Minimal tools**: Agents use filesystem + bash (grep, find, git diff) — no custom retrieval APIs.

---

## Repo layout (canonical)

```
/docs
  /00-index
    index.md
    glossary.md
  /10-requirements
    REQ-0001-*.md
    REQ-0002-*.md
  /20-decisions
    ADR-0001-*.md
    ADR-0002-*.md
  /30-changes
    RFC-0001-*.md
    RFC-0002-*.md
  /40-architecture
    /c4
      context.dsl
      containers.dsl
      components.dsl
      README.md
    /archimate
      elements.yml
      relationships.yml
      /views
        VIEW-*.puml
      README.md
    /views
      landscape.md
      security.md
      data.md
      integrations.md
  /90-appendix
    references.md

/model
  /catalog
    systems.yml
    interfaces.yml
    data-objects.yml
    capabilities.yml
    org.yml

/diagrams
  /c4
    *.dsl                # Structurizr DSL source (canonical)
    /rendered            # generated images (do not edit)
  /archimate
    *.puml               # PlantUML ArchiMate views (canonical)
    /rendered            # generated images (do not edit)
  /mermaid
    *.mmd                # Mermaid sources (canonical)
    /rendered            # generated images (do not edit)

/bin
  validate
  render-diagrams
  check-links
  lint-frontmatter
  new-req
  new-rfc
  new-adr
  ea-trace
  ea-impact
```

### Canonical source formats

| Artifact | Format |
|----------|--------|
| Requirements / Decisions / RFCs | Markdown with YAML frontmatter |
| C4 diagrams | Structurizr DSL (`.dsl`) |
| ArchiMate views | PlantUML with ArchiMate macros (`.puml`) |
| Catalog/model lists | YAML |
| Rendered outputs | `.png`/`.svg` (generated only, never hand-edited) |

---

## YAML Frontmatter Schema

All REQ/RFC/ADR files must have machine-parseable frontmatter:

### Requirement frontmatter
```yaml
---
id: REQ-0001
title: Order Management Capability
status: draft | review | approved | deprecated
owner: platform-team
created: 2025-01-10
updated: 2025-01-12
traces:
  decisions: [ADR-0042, ADR-0051]
  rfcs: [RFC-0023]
  systems: [sys_order_management, sys_inventory]
  views: [VIEW-order-flow, VIEW-integration-landscape]
tags: [capability, core, p0]
---
```

### RFC frontmatter
```yaml
---
id: RFC-0001
title: New Payment Gateway Integration
status: draft | review | accepted | rejected | superseded
author: jane.doe
created: 2025-01-10
traces:
  requirements: [REQ-0042, REQ-0043]
  systems: [sys_payment, sys_order]
  decisions: []
---
```

### ADR frontmatter
```yaml
---
id: ADR-0001
title: Use PostgreSQL for Order Data
status: proposed | accepted | deprecated | superseded
superseded_by: ADR-0099  # if applicable
created: 2025-01-10
traces:
  rfcs: [RFC-0023]
  requirements: [REQ-0001]
  systems: [sys_order_management]
---
```

---

## Architecture change management (Git workflow)

### Change types

| Type | Criteria | Required artifacts |
|------|----------|-------------------|
| Minor | Doc fix, typo, clarifying text | PR only |
| Significant | Scope, target architecture, interfaces, data contracts, security, NFRs | RFC + ADR |
| Breaking | Deprecations, removals, contract changes | RFC + ADR + version bump + migration plan |

### Required flow

1. **Branch** from `main`:
   - `rfc/RFC-####-short-title`
   - `adr/ADR-####-short-title`
   - `arch/short-title`
2. Add/Update **RFC** under `/docs/30-changes/`
3. Add/Update **ADR** under `/docs/20-decisions/` (for significant changes)
4. Update **requirements** (`/docs/10-requirements/`) if scope/NFRs change
5. Update **model + diagrams** (C4 + ArchiMate) as text
6. Run validations + render:
   ```bash
   ./bin/validate
   ./bin/render-diagrams
   ```
7. Open PR with RFC/ADR links, rendered diagrams, and traceability section
8. Review + approval (domain-dependent: security/data/platform/EA)
9. Merge (squash if it preserves meaningful messages)
10. Post-merge: update `/docs/00-index/index.md` if new artifacts added

### Commit message convention

```
EA: ...     # architecture changes
REQ: ...    # requirements
ADR: ...    # decisions
RFC: ...    # change proposals
DIAG: ...   # diagram/model updates
```

---

## Traceability rules

Every significant architecture artifact must reference:
- At least one **REQ-####** (why)
- The relevant **RFC-####** (what changed)
- The relevant **ADR-####** (why this decision)

---

## C4 modeling rules (Structurizr DSL)

**Files**: `/docs/40-architecture/c4/*.dsl` is canonical.

**Naming conventions**:
- System IDs: `sys_<slug>`
- Containers: `ctr_<slug>`
- Components: `cmp_<slug>`
- Relationships must include reason + protocol (e.g., "REST/JSON", "Kafka", "SFTP")

**Required views**:
- Context view for each top-level system
- Container view for each system in scope
- Component view only when needed to explain responsibilities or boundaries

**Output**: Rendered diagrams go to `/diagrams/c4/rendered/`

---

## ArchiMate modeling rules (Enterprise views)

**Canonical model**:
- `/docs/40-architecture/archimate/elements.yml`
- `/docs/40-architecture/archimate/relationships.yml`

**Element requirements**:
```yaml
- id: app_order_service
  name: Order Service
  type: application-component
  description: Handles order lifecycle management
  owner: platform-team
  tags: [core, domain-order]
```

**Relationship requirements**:
```yaml
- from: app_order_service
  to: app_inventory_service
  type: serving
  description: Queries stock availability
```

**Views**: `/docs/40-architecture/archimate/views/VIEW-*.puml`

Each view must state: Purpose, Scope, Mapped requirements (REQ-####)

**Output**: Rendered diagrams go to `/diagrams/archimate/rendered/`

---

## Agent filesystem navigation

Agents explore this repo using standard Unix tools — **no custom retrieval APIs**:

```bash
# Find all requirements impacting a system
rg "sys_order_management" docs/10-requirements/

# Trace an ADR's dependencies
rg "ADR-0042" docs/ --type md

# Discover all views for a capability
find docs/40-architecture -name "*.puml" | xargs grep "capability_order"

# Check what changed in an RFC
git diff main...rfc/RFC-0099-new-integration -- docs/

# Parse frontmatter to build dependency graphs
yq '.traces.systems[]' docs/10-requirements/REQ-*.md | sort -u

# Find all P0 requirements
rg "^tags:.*p0" docs/10-requirements/ -l

# Check RFC status across all proposals
rg "^status:" docs/30-changes/RFC-*.md

# Diff architecture between releases
git diff v1.2.0..v1.3.0 -- docs/40-architecture/
```

### Git primitives as agent operations

| Git Primitive | EA Change Management Mapping |
|--------------|------------------------------|
| `branch` | RFC proposal workspace |
| `worktree` | Parallel RFC/ADR exploration without conflicts |
| `commit` | Atomic architecture change (with prefix) |
| `diff` | Impact analysis |
| `log --follow` | Trace evolution of a requirement or decision |
| `merge` | Decision acceptance |
| `revert` | Rollback architecture change |
| `blame` | Find who/why an element was introduced |

---

## Agent approval gates

### Approval-required actions
- Creating/modifying ADRs with `status: accepted`
- Deleting any REQ/RFC/ADR
- Modifying `elements.yml` or `relationships.yml` (canonical model)
- Running `render-diagrams` (produces artifacts)
- Any `git push`

### Auto-approved actions (within sandbox)
- Reading any file
- Creating draft RFCs
- Running `validate` (read-only)
- `git diff`, `git log`, `git status`
- `grep`/`find`/`cat` operations

---

## Agent operating instructions

When asked to change architecture:

1. **Locate context**:
   ```bash
   rg "REQ-####|RFC-####|ADR-####" -n docs/
   ```
   Inspect relevant `.dsl`, `.puml`, `.yml`

2. **Propose changes** as a branch + PR package:
   - Add/update REQ/RFC/ADR first
   - Then update model + diagrams

3. **Prefer minimal diffs**: do not reformat unrelated files

4. **Always include traceability**: add links among REQ/RFC/ADR and to changed diagrams

5. **Do not execute destructive commands** without explicit approval

6. If any ambiguity exists, encode it as **Open questions** in RFC rather than guessing

---

## Validation and CI expectations

Before opening a PR:

```bash
./bin/validate         # lint + schema + link checks
./bin/render-diagrams  # update rendered outputs
```

**No orphaned artifacts**:
- Every RFC references at least one REQ
- Every ADR references at least one RFC or REQ
- Every diagram is linked from at least one doc page

---

## "Architecture as Code" PR checklist

- [ ] RFC added/updated (if significant)
- [ ] ADR added/updated (if a decision was made)
- [ ] REQ added/updated (if scope/NFR changed)
- [ ] C4 diagrams updated + rendered
- [ ] ArchiMate model + views updated + rendered
- [ ] Traceability sections updated
- [ ] `./bin/validate` passes
- [ ] Index updated (`/docs/00-index/index.md`) if new artifacts added

---

## Build commands (plugin development)

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode (continuous compilation)
npm run lint         # Run ESLint on src/
npm test             # Run vitest tests
```

---

## Plugin architecture

```
src/
├── types/           # Type definitions (C4, ArchiMate, common interfaces)
├── generators/      # Mermaid diagram generators (types → diagram strings)
├── analyzers/       # Codebase analysis helpers and templates
├── skills/          # Slash command implementations (/c4, /archimate, /arch-analyze, /arch-plan)
└── agents/          # Autonomous agents (architecture-documenter)
```

**Data flow**: Types → Generators → Skills/Agents → Mermaid output

**Plugin manifest**: `claude-plugin.json` defines skills (entrypoints in `dist/skills/`) and agents (entrypoints in `dist/agents/`).

---

## TypeScript configuration

- Target: ES2022 with ESNext modules
- Strict mode enabled
- Output: `dist/` with declarations, declaration maps, and source maps
- Uses `.js` extensions in imports (ESM requirement)
