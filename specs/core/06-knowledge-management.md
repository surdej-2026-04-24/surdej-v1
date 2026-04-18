# 06 — Knowledge Management

## Overview

Generic knowledge management platform built into Surdej's core. Provides article authoring,
template-based content creation, approval workflows, training material generation, and
integration adapters for external knowledge bases.

Derived projects connect this to their specific systems (e.g., ServiceNow, Confluence,
SharePoint, Notion) via pluggable adapters.

## Article Management

### Capabilities

- **Template-based authoring** — Define content templates (Work Instructions, Knowledge Articles,
  How-To Guides, FAQs). Authors fill in structured sections; AI validates completeness.
- **AI-assisted content refinement** — Raw drafts are converted into structured,
  template-compliant content by the AI pipeline.
- **Image editing** — AI-assisted annotation: mark steps, blur sensitive data, highlight areas.
- **Metadata suggestions** — AI auto-suggests category, tags, keywords based on content.
- **Duplicate detection** — Semantic search across existing articles to flag potential duplicates
  before publishing.
- **Related article discovery** — Surface relevant existing articles within the same topic.

### Article Lifecycle

```
Draft → AI Refinement → Review → Approved → Published → Archived
```

Each transition is a registered command (e.g., `knowledge.article.submit-review`,
`knowledge.article.approve`, `knowledge.article.publish`).

### Template System

```typescript
interface KnowledgeTemplate {
  id: string;
  name: string;
  sections: TemplateSection[];     // required/optional sections
  validationRules: ValidationRule[];
  category: string;
}

interface TemplateSection {
  id: string;
  title: string;
  required: boolean;
  contentType: "text" | "rich-text" | "image" | "table" | "checklist";
  aiPrompt?: string;               // prompt used for AI-assisted filling
}
```

## Approval Workflows

- Configurable approval chains per template or category.
- Role-based: authors, reviewers, approvers (maps to Surdej's RBAC).
- Status tracking with audit trail.
- Email/notification on state transitions.

## Training Material Generation

### Capabilities

- AI reads training frameworks and designs training sessions autonomously.
- Trainer approval gate before publishing.
- Interactive elements: quizzes, gamification, checklists.
- Modular sessions: drag-and-drop builder.
- Duration planning: hierarchical breakdown (weeks → days → hours).

### Learner Progress

- Web-based progress tracking per learner.
- Individual checklists and completion rates.
- Team-level dashboards and knowledge gap analysis.

## Integration Adapters

Knowledge management connects to external systems via pluggable adapters:

| Adapter | Capabilities | Status |
|---------|-------------|--------|
| **Internal** | Local PostgreSQL storage, full CRUD | ✅ Built-in |
| **ServiceNow** | Article CRUD, duplicate detection, sync | Adapter pattern |
| **Confluence** | Page import/export | Adapter pattern |
| **SharePoint** | Document library integration | Adapter pattern |
| **Notion** | Database sync | Adapter pattern |

Derived projects implement the adapters they need. Surdej core provides the adapter interface
and the internal storage adapter.

```typescript
interface KnowledgeAdapter {
  id: string;
  name: string;
  publishArticle(article: Article): Promise<ExternalRef>;
  syncArticle(ref: ExternalRef): Promise<Article>;
  searchDuplicates(content: string): Promise<DuplicateMatch[]>;
  importArticle(ref: ExternalRef): Promise<Article>;
}
```

## Data Model (Prisma — `knowledge` schema)

| Model | Purpose |
|-------|---------|
| `Article` | Central article record with metadata, status, template ref |
| `ArticleVersion` | Version history with content snapshots |
| `ArticleReview` | Review/approval records with comments |
| `Template` | Content template definitions |
| `TrainingSession` | Training session metadata and module list |
| `TrainingModule` | Individual training module content |
| `LearnerProgress` | Per-learner completion tracking |

> Uses Surdej's segmented Prisma schema pattern — the `knowledge` schema is maintained
> by the knowledge management worker/sub-API independently from the core schema.

## Commands

| Command ID | Description |
|------------|-------------|
| `navigate.knowledge` | Open knowledge management dashboard |
| `navigate.knowledge.articles` | Article list |
| `navigate.knowledge.templates` | Template editor |
| `navigate.knowledge.training` | Training material builder |
| `knowledge.article.create` | Create new article |
| `knowledge.article.submit-review` | Submit for review |
| `knowledge.article.approve` | Approve article |
| `knowledge.article.publish` | Publish to external system |

---

*Genericized from Nexi MS Operations knowledge management requirements. Domain-specific
integrations (ServiceNow, MS Product Library) belong in derived project adapters.*
