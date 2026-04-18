# Surdej — Skin Creation Guide

> How to create custom skins that control branding and sidebar composition.

---

## What is a Skin?

A **Skin** controls three things:

1. **Branding** — Application name, logo, primary color, font family
2. **Sidebar** — Which commands appear and in what order
3. **Theme** — Default light/dark mode preference

Skins are stored in the database and managed via the API. Users can switch between skins, set a default, and customize sidebar order without modifying the skin itself.

---

## Skin Data Model

```
Skin
├── id: string (uuid)
├── name: string
├── description: string
├── isBuiltIn: boolean         # true = seeded, cannot be deleted
├── createdBy: string          # userId of creator
├── branding: JSON
│   ├── appName: string
│   ├── logo: string (URL)
│   ├── primaryColor: string
│   └── fontFamily: string
├── sidebar: JSON              # ordered list of { commandId, group }
└── theme: JSON
    └── defaultMode: "light" | "dark"

UserSkinPreference
├── userId: string
├── skinId: string
├── isDefault: boolean         # skin used on login
├── isActive: boolean          # currently active skin
└── customOrder: JSON          # user-level sidebar overrides
```

---

## Built-In Skins

Two skins are seeded by default:

### Default Skin
- Full sidebar with all core features
- Surdej branding
- Light mode default

### Minimal Skin
- Reduced sidebar (Home, Chat, Settings only)
- Clean, minimal branding
- Light mode default

Built-in skins have `isBuiltIn: true` and **cannot be deleted** via the API.

---

## Creating a Custom Skin

### Via API

```bash
# Create a custom skin
curl -X POST http://localhost:5001/api/skins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "My Custom Skin",
    "description": "Custom layout for my team",
    "branding": {
      "appName": "TeamHub",
      "primaryColor": "#6366f1",
      "fontFamily": "Inter"
    },
    "sidebar": [
      { "commandId": "navigate.home", "group": "Main" },
      { "commandId": "navigate.chat", "group": "Main" },
      { "commandId": "domain.pdf-refinery.refinery", "group": "PDF Refinery" },
      { "commandId": "domain.pdf-refinery.upload", "group": "PDF Refinery" },
      { "commandId": "navigate.settings", "group": "System" }
    ],
    "theme": {
      "defaultMode": "dark"
    }
  }'
```

### Via Cloning

```bash
# Clone an existing skin
curl -X POST http://localhost:5001/api/skins/SKIN_ID/clone \
  -H "Authorization: Bearer $TOKEN"
```

### Via the Skin Editor UI

1. Navigate to **Settings → Skins**
2. Click **Clone** on any existing skin
3. Drag-and-drop sidebar items to reorder
4. Update branding fields
5. Click **Save**

---

## Skin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/skins` | GET | List all skins |
| `/api/skins` | POST | Create a custom skin |
| `/api/skins/:id` | GET | Get skin details |
| `/api/skins/:id` | PUT | Update skin (owner/admin only) |
| `/api/skins/:id` | DELETE | Delete custom skin |
| `/api/skins/:id/clone` | POST | Clone a skin |
| `/api/skins/me` | GET | Get current user's active skin |
| `/api/skins/me` | PUT | Set active skin for this session |
| `/api/skins/me/default` | PUT | Set default skin (applied on login) |
| `/api/skins/me/order` | PUT | Save custom sidebar order |

---

## User Skin Preferences

Each user has a relationship to skins through `UserSkinPreference`:

- **Default skin** — The skin loaded on login (`isDefault: true`)
- **Active skin** — The skin currently being used (`isActive: true`)
- **Custom order** — Per-user sidebar reordering within a skin

A user can:
- **Switch skins** at any time (changes active skin, not default)
- **Set a default** that persists across sessions
- **Reorder sidebar items** within any skin without modifying the skin

---

## Sidebar Composition

The sidebar renders items from the active skin's `sidebar` array. Each item:

```typescript
{
    commandId: string;   // References a registered command
    group?: string;      // Visual grouping in sidebar
    order?: number;      // Sort order within group
}
```

The command system resolves each `commandId` to its icon, title, and handler:

```
Skin sidebar → commandId → CommandRegistry → Icon + Title + Handler
```

If a command is not registered (e.g., domain not loaded), the sidebar item is hidden.

---

## Skin Switching Flow

```
Login
  │
  ▼
GET /api/skins/me → returns active or default skin
  │
  ▼
Load skin → Apply branding + sidebar + theme
  │
  ▼
User clicks "Switch Skin"
  │
  ▼
PUT /api/skins/me { skinId } → new active skin
  │
  ▼
UI updates instantly (Zustand) + synced to API
```

---

## Best Practices

1. **Start by cloning** — Clone an existing skin rather than creating from scratch
2. **Group logically** — Use `group` to organize sidebar items by domain
3. **Keep it focused** — Don't include every command; curate for the use case
4. **Use consistent branding** — Match colors and fonts to your organization
5. **Test with different roles** — Some commands may be `when`-gated

---

## See Also

- [Architecture Guide](./architecture.md) — Skin system design
- [Domain Extension Guide](./domain-extension.md) — Adding sidebar items
