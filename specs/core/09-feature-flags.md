# 09 — Feature Flags

## Overview

Ring-based progressive feature rollout system. Identical implementation across both source projects.

## Ring Model

| Ring | Name | Audience | Description |
|------|------|----------|-------------|
| 1 | Internal | Developers | New/experimental features, may be unstable |
| 2 | Beta | Testers | Feature-complete, under validation |
| 3 | Preview | Early adopters | Near-production, gathering feedback |
| 4 | Stable | All users | Production-ready, fully released |

## Implementation

### Feature Definition

Central `features.ts` file with an array of `FeatureDefinition` objects:

```typescript
interface FeatureDefinition {
  id: string;          // Unique feature identifier
  name: string;        // Human-readable name
  description: string; // Feature description
  ring: 1 | 2 | 3 | 4; // Current rollout ring
  enabled: boolean;    // Global enable/disable
}
```

### FeatureContext

React Context providing:

- `isEnabled(featureId: string): boolean` — Check if a feature is enabled for the current ring
- `toggleFeature(featureId: string): void` — Toggle feature visibility (dev/settings)
- `features: FeatureDefinition[]` — All registered features

### useFeature Hook

```typescript
import { useFeature } from "@/contexts/FeatureContext";

function MyComponent() {
  const isEnabled = useFeature("my-new-feature");
  if (!isEnabled) return null;
  return <NewFeature />;
}
```

### Settings UI

Feature flag toggles available at `/settings/features`. Shows all registered features with their ring level and enabled state.

### Persistence

Feature overrides persisted to IndexedDB or `localStorage`.

## Usage Pattern

1. Define new feature in `features.ts` at Ring 1 (Internal)
2. Wrap feature UI with `useFeature("feature-id")` guard
3. Promote through rings as confidence grows: 1 → 2 → 3 → 4
4. At Ring 4 (Stable), feature is visible to all users
5. Eventually remove the feature flag wrapper when fully stable

---

*Consolidated from: `ideas/feature.md`, `.agent/instructions.md` (both projects).*
