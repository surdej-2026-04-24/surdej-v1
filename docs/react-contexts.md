# React Contexts

All React Contexts implemented in the Surdej frontend.

Each context follows the **Provider + Hook** pattern: a `<Provider>` wraps the app tree and a `useXxx()` hook provides typed access to the context value. Contexts are composed in `main.tsx` in a specific nesting order (outermost → innermost) reflecting their dependency graph.

---

## Provider Nesting Order

```tsx
// main.tsx
<BrowserRouter>
  <AccessibilityProvider>         // 1. Theme, font, motion ──── no dependencies
    <I18nProvider>                 // 2. Locale / translations ── no dependencies
      <AuthProvider>               // 3. Auth state + MSAL ────── needs Router
        <FeatureProvider>          // 4. Feature flags ─────────── needs Auth
          <TenantProvider>         // 5. Multi-tenancy ─────────── needs Auth
            <SkinProvider>         // 6. UI skin system ────────── needs Auth
              <WireframeProvider>  // 7. Wireframe overlay ─────── standalone
                <FeedbackProvider> // 8. Bug/feedback capture ─── standalone
                  <App />
                </FeedbackProvider>
              </WireframeProvider>
            </SkinProvider>
          </TenantProvider>
        </FeatureProvider>
      </AuthProvider>
    </I18nProvider>
  </AccessibilityProvider>
</BrowserRouter>
```

---

## 1. AccessibilityContext

| | |
|---|---|
| **File** | `core/accessibility/AccessibilityContext.tsx` |
| **Provider** | `<AccessibilityProvider>` |
| **Hook** | `useAccessibility()` |
| **Persistence** | `localStorage` (`surdej_a11y_*`) |
| **API calls** | None |

### Purpose

Controls visual accessibility preferences: light/dark/system theme, high contrast mode, font scaling (100–150%), and reduced motion. Applies settings to the DOM root element via `data-*` attributes and CSS class toggling.

### Exposed State

```ts
interface AccessibilityState {
    theme: 'light' | 'dark' | 'system';
    resolvedTheme: 'light' | 'dark';
    highContrast: boolean;
    fontScale: 100 | 110 | 120 | 130 | 140 | 150;
    reduceMotion: boolean;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    setHighContrast: (v: boolean) => void;
    setFontScale: (v: FontScale) => void;
    setReduceMotion: (v: boolean) => void;
}
```

### Key Behaviours

- Listens to `prefers-color-scheme` media query changes for `system` mode
- Applies `.dark` class to `<html>` for shadcn dark mode
- All preferences persisted to `localStorage`

---

## 2. I18nContext

| | |
|---|---|
| **File** | `core/i18n/I18nProvider.tsx` |
| **Provider** | `<I18nProvider>` |
| **Hook** | `useTranslation()` |
| **Persistence** | `localStorage` (`surdej:locale`) |
| **API calls** | None |

### Purpose

Lightweight, type-safe internationalisation. Supports English (`en`) and Danish (`da`) with dot-path key lookup and `{param}` template interpolation.

### Exposed State

```ts
interface I18nContextValue {
    locale: 'en' | 'da';
    setLocale: (locale: Locale) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    locales: LocaleInfo[];   // all supported locales with labels + flags
}
```

### Key Behaviours

- Auto-detects browser language on first visit
- Sets `document.documentElement.lang` on locale change
- Type-safe `TranslationKey` type generated from the English locale file

---

## 3. AuthContext

| | |
|---|---|
| **File** | `core/auth/AuthContext.tsx` |
| **Provider** | `<AuthProvider>` |
| **Hook** | `useAuth()` |
| **Persistence** | Session cookie |
| **API calls** | `GET /auth/me`, `POST /auth/demo-login`, `POST /auth/logout` |

### Purpose

Authentication state management. Supports two login methods:

1. **Demo login** — email-based bypass for development
2. **Microsoft MSAL** — Azure AD authentication with PKCE flow

### Exposed State

```ts
interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string) => Promise<void>;
    loginWithMicrosoft: (clientId?: string, tenantId?: string) => Promise<void>;
    logout: () => void;
    setSession: (token: string, user: User) => void;
}

interface User {
    id: string;
    email: string;
    name: string;
    displayName: string;
    role: string;
    avatarUrl?: string;
}
```

### Key Behaviours

- Restores session on mount via `GET /auth/me`
- Sets Bearer token on `api` client for subsequent requests
- MSAL uses popup-based flow (not redirect)

---

## 4. FeatureContext

| | |
|---|---|
| **File** | `core/features/FeatureContext.tsx` |
| **Provider** | `<FeatureProvider>` |
| **Hooks** | `useFeature(featureId)` · `useFeatures()` |
| **Persistence** | `localStorage` (`surdej_feature_*`, `surdej_user_ring`) |
| **API calls** | `GET /features` |
| **Depends on** | `api` (uses auth token) |

### Purpose

Ring-based feature flag system. Each feature has a "ring" level (1=Internal → 4=Stable). Users set their ring level, and features at that ring or below are enabled. Individual features can be overridden via localStorage.

### Exposed State

```ts
interface FeatureState {
    features: Feature[];
    isLoading: boolean;
    userRing: number;                           // 1–4
    setUserRing: (ring: number) => void;
    isEnabled: (featureId: string) => boolean;  // ring check + localStorage override
    toggleFeature: (featureId: string) => void; // flip localStorage override
}
```

### Current Feature Flags

| Feature ID | Ring | Description |
|---|---|---|
| `command-palette` | 4 (Stable) | Quick command access via ⌘K |
| `feedback-system` | 2 (Beta) | Screenshot, voice, and video feedback |
| `skin-editor` | 2 (Beta) | Visual sidebar customisation editor |
| `dev-inspector` | 1 (Internal) | Ctrl+Option hover to inspect component source |
| `topology-viewer` | 1 (Internal) | Interactive infrastructure topology explorer |
| `wireframe-mode` | 1 (Internal) | Overlay layout region outlines |

---

## 5. TenantContext

| | |
|---|---|
| **File** | `core/tenants/TenantContext.tsx` |
| **Provider** | `<TenantProvider>` |
| **Hook** | `useTenant()` |
| **Persistence** | Server-side (session) |
| **API calls** | `GET /tenants/me`, `GET /tenants`, `PUT /tenants/me` |
| **Depends on** | `AuthContext` (uses `isAuthenticated`) |

### Purpose

Multi-tenancy support. Manages the active tenant, provides a tenant switch function that invalidates all client-side caches, and sends `X-Tenant-Id` on every API request via the `api` client.

### Exposed State

```ts
interface TenantContextValue {
    activeTenant: Tenant | null;
    allTenants: Tenant[];                    // excludes soft-deleted
    allTenantsIncludingDeleted: Tenant[];    // includes soft-deleted
    isLoading: boolean;
    switchTenant: (tenantId: string) => Promise<void>;
    refreshTenants: () => Promise<void>;
    tenantVersion: number;   // bumped on switch — add to useEffect deps to auto-refresh
}
```

### Key Behaviours

- Calls `api.setTenantId()` on every tenant change → all outgoing requests include `X-Tenant-Id`
- `tenantVersion` counter allows components to re-fetch data on tenant switch
- Falls back to a demo tenant when the API is unavailable

---

## 6. SkinContext

| | |
|---|---|
| **File** | `core/skins/SkinContext.tsx` |
| **Provider** | `<SkinProvider>` |
| **Hook** | `useSkin()` |
| **Persistence** | Server-side |
| **API calls** | `GET /skins/me`, `GET /skins`, `PUT /skins/me`, `PUT /skins/me/default` |
| **Depends on** | `AuthContext` (uses `isAuthenticated`) |

### Purpose

Dynamic UI skinning system. Skins control sidebar items, activity bar items, branding (app name, logo, colors, font), theme, and homepage layout. Each tenant can have its own skin.

### Exposed State

```ts
interface SkinContextValue {
    activeSkin: Skin | null;
    allSkins: Skin[];
    isLoading: boolean;
    switchSkin: (skinId: string) => Promise<void>;
    setDefaultSkin: (skinId: string) => Promise<void>;
    refreshSkins: () => Promise<void>;
}

interface Skin {
    id: string;
    name: string;
    description?: string;
    isBuiltIn: boolean;
    branding: SkinBranding;             // appName, logo, primaryColor, fontFamily
    sidebar: SkinSidebarItem[];         // commandId + group
    activityBar?: SkinActivityBarItem[]; // id, label, icon, path
    homepageConfig?: any;               // JSON layout config
    theme?: SkinTheme;                  // defaultMode: light | dark
}
```

### Key Behaviours

- Normalizes API responses (branding/sidebar may arrive as JSON strings)
- Falls back to built-in `Default` and `Minimal` skins when API is unavailable
- Two built-in skins ship with the app

---

## 7. WireframeContext

| | |
|---|---|
| **File** | `core/wireframe/WireframeContext.tsx` |
| **Provider** | `<WireframeProvider>` |
| **Hook** | `useWireframe()` |
| **Persistence** | None (session-only) |
| **API calls** | None |

### Purpose

Debug overlay that outlines layout regions. Toggled via keyboard shortcut or the command palette.

### Exposed State

```ts
interface WireframeContextValue {
    isActive: boolean;
    toggle: () => void;
    setActive: (active: boolean) => void;
}
```

### Key Behaviours

- Toggle: `Ctrl + Option + Cmd + W`
- Exit: `Escape`
- Also listens for `surdej:toggle-wireframe` custom DOM event (fired by command palette)

---

## 8. FeedbackContext

| | |
|---|---|
| **File** | `core/feedback/FeedbackContext.tsx` |
| **Provider** | `<FeedbackProvider>` |
| **Hook** | `useFeedback()` |
| **Persistence** | `localStorage` (`surdej_feedback_entries`) |
| **API calls** | None (planned: `POST /api/feedback`) |

### Purpose

In-app bug reporting and feedback system. Supports creating annotated feedback entries with screenshots, priority levels, and classification (bug, feature, improvement, question).

### Exposed State

```ts
interface FeedbackContextValue {
    entries: FeedbackEntry[];
    activeEntry: FeedbackEntry | null;
    createEntry: () => FeedbackEntry;
    updateEntry: (id: string, updates: Partial<FeedbackEntry>) => void;
    deleteEntry: (id: string) => void;
    submitEntry: (id: string) => Promise<void>;
    setActiveEntry: (entry: FeedbackEntry | null) => void;
    captureScreenshot: () => Promise<string | null>;
}
```

### Key Behaviours

- Entries persist to `localStorage` across sessions
- Screenshot capture via `html2canvas` when available
- Supports annotation items: arrow, rect, circle, text, blur

---

## 9. JobContext

| | |
|---|---|
| **File** | `core/jobs/JobContext.tsx` |
| **Provider** | `<JobProvider>` |
| **Hook** | `useJobs()` |
| **Persistence** | Server-side |
| **API calls** | `GET /jobs`, `POST /jobs/*` |
| **Depends on** | `AuthContext` (uses `isAuthenticated`) |

### Purpose

Long-running background job management. Tracks tenant export/import/copy operations with progress polling. The `JobIndicator` component in the header shows active and completed jobs.

### Exposed State

```ts
interface JobContextValue {
    jobs: Job[];
    activeJobs: Job[];       // pending + running
    completedJobs: Job[];    // completed + failed
    isLoading: boolean;
    startJob: (endpoint: string, payload: unknown) => Promise<Job>;
    refreshJobs: () => Promise<void>;
    dismissJob: (jobId: string) => void;
}
```

### Key Behaviours

- Adaptive polling: 2s when jobs are active, 30s when idle
- Jobs are typed: `export_tenant`, `import_tenant`, `copy_tenant`
- `startJob` posts to any endpoint and tracks the returned job

---

## Dependency Graph

```
AccessibilityContext ──┐
I18nContext ───────────┤
                       ├─▶  AuthContext ──┬─▶  FeatureContext
                       │                  ├─▶  TenantContext ──▶ (api.setTenantId)
                       │                  ├─▶  SkinContext
                       │                  └─▶  JobContext
                       │
WireframeContext ──────┤
FeedbackContext ───────┘
```

**Legend:**
- **Arrow (▶)** = depends on (reads from parent context)
- Contexts without arrows are standalone — they can function without any other context

---

## Adding a New Context

1. Create `core/<name>/<Name>Context.tsx` following the Provider + Hook pattern
2. Add the Provider to `main.tsx` at the appropriate nesting depth
3. Export the hook from `core/<name>/index.ts` for clean imports
4. Document it in this file
