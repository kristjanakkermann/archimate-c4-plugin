/**
 * Architecture Plan Skill
 * Create architectural plans and design documents
 *
 * Usage: /arch-plan [type] [options]
 *
 * Types:
 *   adr        - Architectural Decision Record
 *   design     - Design document with diagrams
 *   migration  - Migration plan between architectures
 *
 * Options:
 *   --title <title>   - Document title
 *   --context <ctx>   - Context for the decision/design
 *   --output <fmt>    - Diagram format (mermaid, plantuml)
 */

import type { SkillContext, SkillResult, ArchitecturalDecision } from '../types/index.js';

export const SKILL_NAME = 'architecture-plan';
export const SKILL_COMMAND = 'arch-plan';
export const SKILL_DESCRIPTION = 'Create architectural decision records and design documents';

export const SKILL_PROMPT = `You are an expert software architect helping to create architectural documentation for planning and design decisions.

## Document Types

### Architectural Decision Record (ADR)
ADRs document important architectural decisions. Use this format:

\`\`\`markdown
# ADR-[number]: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[Describe the issue/situation requiring a decision]

## Decision
[Describe the decision that was made]

## Consequences
[List the positive and negative consequences]

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Drawback 1]
- [Drawback 2]

## Alternatives Considered
### [Alternative 1]
- Pros: [...]
- Cons: [...]

### [Alternative 2]
- Pros: [...]
- Cons: [...]
\`\`\`

### Design Document
Design documents describe proposed system changes with diagrams:

\`\`\`markdown
# Design: [Title]

## Overview
[Brief description of the proposed design]

## Goals
- [Goal 1]
- [Goal 2]

## Non-Goals
- [Non-goal 1]

## Current State
[Description of how things work now]

### Current Architecture
\`\`\`mermaid
[C4 or ArchiMate diagram of current state]
\`\`\`

## Proposed Design
[Detailed description of the proposed changes]

### Proposed Architecture
\`\`\`mermaid
[C4 or ArchiMate diagram of proposed state]
\`\`\`

## Implementation Plan
1. [Phase 1]
2. [Phase 2]
3. [Phase 3]

## Risks and Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | High/Med/Low | High/Med/Low | [Mitigation] |

## Open Questions
- [Question 1]
- [Question 2]
\`\`\`

### Migration Plan
Migration plans document transitions between architectures:

\`\`\`markdown
# Migration Plan: [Title]

## Current State (Baseline)
[Description]

### Baseline Architecture
\`\`\`mermaid
[ArchiMate diagram with current elements]
\`\`\`

## Target State
[Description of target architecture]

### Target Architecture
\`\`\`mermaid
[ArchiMate diagram with target elements]
\`\`\`

## Migration Phases

### Phase 1: [Name]
**Duration**: [Estimate]
**Changes**:
- [Change 1]
- [Change 2]

**Architecture after Phase 1**:
\`\`\`mermaid
[Intermediate state diagram]
\`\`\`

### Phase 2: [Name]
[Continue for each phase]

## Rollback Plan
[How to rollback if needed]

## Success Criteria
- [Criterion 1]
- [Criterion 2]
\`\`\`

## Guidelines

When creating architecture documents:

1. **Be Specific**: Use concrete technology names, not generic terms
2. **Show Trade-offs**: Every decision has pros and cons
3. **Include Diagrams**: Visual representations aid understanding
4. **Consider Evolution**: How will this change over time?
5. **Document Assumptions**: What are you assuming to be true?

## C4 Diagram Guidelines for Planning

For proposed architectures, show:
- New elements in a distinct style
- Elements to be removed (strikethrough or dashed)
- Modified elements clearly marked

## ArchiMate Migration Guidelines

Use ArchiMate implementation & migration elements:
- **Plateau**: Target architecture state
- **Gap**: Differences between plateaus
- **Work Package**: Activities to close gaps
- **Deliverable**: Outputs of work packages
`;

interface PlanSkillArgs {
  type?: 'adr' | 'design' | 'migration';
  title?: string;
  context?: string;
  output?: 'mermaid' | 'plantuml';
}

/**
 * Parse skill arguments
 */
export function parseArgs(argsString?: string): PlanSkillArgs {
  const args: PlanSkillArgs = {
    type: 'design',
    output: 'mermaid'
  };

  if (!argsString) return args;

  const parts = argsString.split(/\s+/);
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];

    if (['adr', 'design', 'migration'].includes(part)) {
      args.type = part as 'adr' | 'design' | 'migration';
    } else if (part === '--title' && parts[i + 1]) {
      args.title = parts.slice(i + 1).join(' ').replace(/^["']|["']$/g, '');
      break; // Title consumes rest of args
    } else if (part === '--context' && parts[i + 1]) {
      args.context = parts[++i];
    } else if (part === '--output' && parts[i + 1]) {
      args.output = parts[++i] as 'mermaid' | 'plantuml';
    }

    i++;
  }

  return args;
}

/**
 * Generate ADR template
 */
function generateADRTemplate(title?: string): string {
  const adrNumber = 'XXX'; // Would be generated
  const adrTitle = title || '[Decision Title]';

  return `# ADR-${adrNumber}: ${adrTitle}

## Status
Proposed

## Date
${new Date().toISOString().split('T')[0]}

## Context
[Describe the context and problem statement. What is the issue that is motivating this decision?]

## Decision Drivers
- [Driver 1: e.g., scalability requirements]
- [Driver 2: e.g., team expertise]
- [Driver 3: e.g., time constraints]

## Considered Options
1. [Option 1]
2. [Option 2]
3. [Option 3]

## Decision Outcome
Chosen option: "[Option X]" because [justification].

### Positive Consequences
- [Positive consequence 1]
- [Positive consequence 2]

### Negative Consequences
- [Negative consequence 1]
- [Negative consequence 2]

## Pros and Cons of the Options

### [Option 1]
- ✅ [Pro 1]
- ✅ [Pro 2]
- ❌ [Con 1]

### [Option 2]
- ✅ [Pro 1]
- ❌ [Con 1]
- ❌ [Con 2]

### [Option 3]
- ✅ [Pro 1]
- ❌ [Con 1]

## Links
- [Link to related ADR]
- [Link to related documentation]
`;
}

/**
 * Generate design document template
 */
function generateDesignTemplate(title?: string): string {
  return `# Design Document: ${title || '[Feature/System Name]'}

## Metadata
- **Author**: [Name]
- **Created**: ${new Date().toISOString().split('T')[0]}
- **Status**: Draft
- **Reviewers**: [Names]

## Overview
[Provide a brief summary of the proposed design in 2-3 sentences]

## Goals
- [ ] [Primary goal 1]
- [ ] [Primary goal 2]
- [ ] [Primary goal 3]

## Non-Goals
- [What this design explicitly does NOT address]

## Background
[Provide context about the current system and why this change is needed]

## Current Architecture

\`\`\`mermaid
graph TB
    subgraph current["Current State"]
        %% Add current architecture elements
        A[Component A] --> B[Component B]
    end
\`\`\`

## Proposed Design

### High-Level Architecture

\`\`\`mermaid
graph TB
    subgraph proposed["Proposed State"]
        %% Add proposed architecture elements
        A[Component A] --> B[Component B]
        A --> C[New Component C]
    end
\`\`\`

### Detailed Design

#### Component 1: [Name]
[Detailed description]

#### Component 2: [Name]
[Detailed description]

### Data Model Changes
[Describe any database or data structure changes]

### API Changes
[Describe any API additions or modifications]

## Implementation Plan

### Phase 1: [Name] (Week 1-2)
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Name] (Week 3-4)
- [ ] Task 3
- [ ] Task 4

## Testing Strategy
- Unit tests: [approach]
- Integration tests: [approach]
- E2E tests: [approach]

## Monitoring and Observability
- Metrics to track: [list]
- Alerts to set up: [list]

## Rollout Plan
- [ ] Deploy to staging
- [ ] Smoke tests
- [ ] Gradual rollout (10% → 50% → 100%)

## Rollback Plan
[How to quickly rollback if issues are discovered]

## Security Considerations
[Any security implications or requirements]

## Open Questions
- [ ] [Question 1]
- [ ] [Question 2]

## Appendix
[Additional diagrams, data, or references]
`;
}

/**
 * Generate migration plan template
 */
function generateMigrationTemplate(title?: string): string {
  return `# Migration Plan: ${title || '[Migration Name]'}

## Overview
[Brief description of the migration]

## Motivation
[Why is this migration necessary?]

## Scope
- **In Scope**: [What's included]
- **Out of Scope**: [What's explicitly excluded]

## Current State (Baseline)

### Architecture
\`\`\`mermaid
graph TB
    subgraph baseline["Baseline Architecture"]
        A[Legacy Component A]
        B[Legacy Component B]
        A --> B
    end
\`\`\`

### Current Metrics
- [Metric 1]: [Value]
- [Metric 2]: [Value]

## Target State

### Architecture
\`\`\`mermaid
graph TB
    subgraph target["Target Architecture"]
        A2[New Component A]
        B2[New Component B]
        C[New Component C]
        A2 --> B2
        A2 --> C
    end
\`\`\`

### Expected Improvements
- [Improvement 1]
- [Improvement 2]

## Gap Analysis

| Gap | Current | Target | Effort |
|-----|---------|--------|--------|
| [Gap 1] | [Current state] | [Target state] | High/Med/Low |
| [Gap 2] | [Current state] | [Target state] | High/Med/Low |

## Migration Phases

### Phase 1: Preparation
**Duration**: [Estimate]

#### Tasks
- [ ] Set up new infrastructure
- [ ] Create migration scripts
- [ ] Set up monitoring

#### Exit Criteria
- [Criterion 1]
- [Criterion 2]

### Phase 2: Parallel Running
**Duration**: [Estimate]

#### Tasks
- [ ] Deploy new system alongside old
- [ ] Mirror traffic to both systems
- [ ] Compare results

#### Architecture
\`\`\`mermaid
graph TB
    subgraph phase2["Phase 2: Parallel Running"]
        OLD[Legacy System]
        NEW[New System]
        LB[Load Balancer]
        LB --> OLD
        LB --> NEW
    end
\`\`\`

### Phase 3: Cutover
**Duration**: [Estimate]

#### Tasks
- [ ] Switch primary traffic to new system
- [ ] Keep old system on standby
- [ ] Monitor for issues

### Phase 4: Cleanup
**Duration**: [Estimate]

#### Tasks
- [ ] Decommission old system
- [ ] Clean up temporary infrastructure
- [ ] Update documentation

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | High/Med/Low | High/Med/Low | [Mitigation strategy] |
| [Risk 2] | High/Med/Low | High/Med/Low | [Mitigation strategy] |

## Rollback Plan

### Triggers for Rollback
- [Trigger 1: e.g., error rate > 5%]
- [Trigger 2: e.g., latency > 500ms]

### Rollback Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Recovery Time Objective (RTO)
[Expected time to rollback]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Communication Plan
| Audience | What | When | How |
|----------|------|------|-----|
| [Stakeholders] | [Content] | [Timing] | [Channel] |

## Post-Migration
- [ ] Update runbooks
- [ ] Update architecture diagrams
- [ ] Conduct retrospective
`;
}

/**
 * Main skill execution
 */
export async function execute(context: SkillContext): Promise<SkillResult> {
  const args = parseArgs(context.args);

  let template: string;

  switch (args.type) {
    case 'adr':
      template = generateADRTemplate(args.title);
      break;
    case 'migration':
      template = generateMigrationTemplate(args.title);
      break;
    case 'design':
    default:
      template = generateDesignTemplate(args.title);
      break;
  }

  const output = `# Architecture Planning Document

Generated template for: **${args.type?.toUpperCase() || 'DESIGN'}**

---

${template}

---

## Instructions

This is a template. Please:
1. Fill in the bracketed placeholders with your specific information
2. Update the Mermaid diagrams to reflect your actual architecture
3. Remove any sections that don't apply
4. Add additional sections as needed

Use \`/c4\` or \`/archimate\` commands to generate specific diagrams.
`;

  return {
    success: true,
    output,
    diagrams: []
  };
}
