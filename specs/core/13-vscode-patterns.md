# 13 — VS Code Architectural Patterns Worth Adopting

## Overview

VS Code is one of the best-architected TypeScript applications ever built. This document distills
the patterns from its internals that are most relevant to Surdej — a web-app framework, not an
IDE — and maps them to concrete adoption recommendations.

**Sources:** `microsoft/vscode` repository — `src/vs/platform/`, `src/vs/workbench/`, `src/vs/base/`.

---

## 1. Command Registry — Validated, Enhanced

Surdej already specifies a command system (spec §4). VS Code's implementation confirms and
refines our approach with several patterns worth adopting:

### 1.1 Commands Return Disposables

Every `registerCommand()` call returns an `IDisposable`. Calling `.dispose()` unregisters
the command. This is critical for domain modules that mount/unmount.

```typescript
// VS Code pattern:
const reg = CommandsRegistry.registerCommand("foo", handler);
reg.dispose(); // cleanly removes the command
```

**Surdej adoption:** `commandRegistry.register()` must return a `Disposable`. Domain modules
call `.dispose()` on teardown.

### 1.2 Command Metadata & Argument Validation

VS Code commands carry typed metadata describing their arguments, enabling auto-documentation
and runtime validation:

```typescript
interface ICommandMetadata {
  description: string;
  args?: Array<{
    name: string;
    isOptional?: boolean;
    description?: string;
    constraint?: TypeConstraint;
    schema?: IJSONSchema;
  }>;
  returns?: string;
}
```

**Surdej adoption:** Extend `CommandDefinition` with optional `metadata` field for commands
that accept arguments (e.g., `navigate.chat` accepting a `chatId`).

### 1.3 Command Aliases

```typescript
CommandsRegistry.registerCommandAlias(oldId, newId);
```

Useful when renaming commands — the old ID forwards to the new one. Prevents breaking changes
in skins that reference command IDs.

### 1.4 onDidRegisterCommand Event

VS Code fires an event when new commands are registered, enabling deferred resolution:

```typescript
CommandsRegistry.onDidRegisterCommand; // Event<string>
```

**Surdej adoption:** The `CommandRegistry` should expose an observable/event for dynamic UI
(e.g., palette rebuilding when a domain module lazy-loads new commands).

### 1.5 Stacking & Override

VS Code uses a `LinkedList` per command ID — registering the same ID pushes onto a stack.
Disposing the override restores the previous handler. This supports plugin-style overrides.

---

## 2. Disposable Pattern — Adopt Wholesale

This is VS Code's most universally valuable pattern. Every resource that needs cleanup implements
`IDisposable`. The framework provides a rich toolkit around it.

### 2.1 Core Interface

```typescript
interface IDisposable {
  dispose(): void;
}
```

### 2.2 DisposableStore (Group Lifecycle)

The primary way to manage multiple disposables. Safer than a raw array — handles edge cases
like double-dispose, disposed-store-add, and error aggregation.

```typescript
class DisposableStore implements IDisposable {
  add<T extends IDisposable>(o: T): T;
  delete<T extends IDisposable>(o: T): void;
  clear(): void;   // dispose all but don't mark store as disposed
  dispose(): void;  // dispose all AND mark as disposed
}
```

### 2.3 Disposable Base Class

```typescript
abstract class Disposable implements IDisposable {
  static readonly None = { dispose() {} };  // null-object pattern

  protected readonly _store = new DisposableStore();

  protected _register<T extends IDisposable>(o: T): T {
    return this._store.add(o);
  }

  dispose(): void {
    this._store.dispose();
  }
}
```

### 2.4 MutableDisposable (Swappable Values)

When a value changes over time and each old value must be disposed:

```typescript
class MutableDisposable<T extends IDisposable> implements IDisposable {
  get value(): T | undefined;
  set value(value: T | undefined); // disposes previous
  clear(): void;
  dispose(): void;
}
```

### 2.5 DisposableMap & DisposableSet

Type-safe collections that automatically dispose removed/replaced entries:

```typescript
class DisposableMap<K, V extends IDisposable> implements IDisposable {
  set(key: K, value: V): void;       // disposes old value at key
  deleteAndDispose(key: K): void;
  deleteAndLeak(key: K): V | undefined; // caller takes ownership
}
```

### 2.6 Utility Functions

```typescript
function toDisposable(fn: () => void): IDisposable;        // wrap cleanup fn
function combinedDisposable(...d: IDisposable[]): IDisposable; // group ad-hoc
function markAsSingleton<T extends IDisposable>(t: T): T;  // skip leak checks
```

### 2.7 Leak Detection (Dev Only)

VS Code tracks every disposable's creation stack trace and reports leaks in tests:

```typescript
class DisposableTracker implements IDisposableTracker {
  trackDisposable(d: IDisposable): void;
  setParent(child: IDisposable, parent: IDisposable | null): void;
  markAsDisposed(d: IDisposable): void;
  computeLeakingDisposables(): { leaks: DisposableInfo[]; details: string };
}
```

**Surdej adoption:** Create `@surdej/core/lifecycle` with `IDisposable`, `Disposable`,
`DisposableStore`, `MutableDisposable`, `toDisposable`, `combinedDisposable`. Enable
leak tracking in dev mode. Every service, subscription, and event listener must use this.

---

## 3. Service Architecture & Dependency Injection

VS Code's DI is decorator-based and surprisingly lightweight. While React's context system
serves a different purpose, the patterns translate well.

### 3.1 Service Identifier as Decorator

```typescript
const ICommandService = createDecorator<ICommandService>("commandService");

// Usage as TypeScript parameter decorator:
class MyClass {
  constructor(@ICommandService private commandService: ICommandService) {}
}
```

`createDecorator` is the **only** way to create a service identifier. It doubles as:
- A unique ID (the string)
- A TypeScript decorator (parameter injection)
- A type brand (the generic `<T>`)

### 3.2 Service Collection & Instantiation

```typescript
const collection = new ServiceCollection();
collection.set(ICommandService, new SyncDescriptor(CommandService));

const instantiation = new InstantiationService(collection);
const myClass = instantiation.createInstance(MyClass);
// CommandService is auto-injected
```

### 3.3 invokeFunction Pattern (Service Accessor)

Instead of injecting services into objects, VS Code often passes a `ServicesAccessor` into
function handlers:

```typescript
CommandsRegistry.registerCommand("myCmd", (accessor: ServicesAccessor, ...args) => {
  const commandService = accessor.get(ICommandService);
  const logService = accessor.get(ILogService);
  // ...
});
```

This is **the** pattern `registerAction2` uses — the `run` method receives a `ServicesAccessor`.

### 3.4 Delayed Instantiation

Services can be lazy — created on first access via `SyncDescriptor`:

```typescript
registerSingleton(ICommandService, CommandService, InstantiationType.Delayed);
```

### 3.5 Child Scopes

```typescript
const child = instantiation.createChild(new ServiceCollection(
  [ISomeService, overrideInstance]
));
```

Child inherits parent services but can override. Disposed separately.

**Surdej adoption:** We don't need VS Code's full DI (React context works). But adopt:
- **Interface + implementation separation** — services always have an `I*` interface.
- **`accessor` pattern for command handlers** — commands receive a service getter, not imports.
- **Lazy instantiation** — heavy services (AI, SharePoint) init on first use.
- **Child scopes** — domain modules get their own service scope inheriting from core.

---

## 4. Context Keys — Conditional UI

VS Code's most powerful UI pattern. Context keys are boolean/string/number values that drive
`when` clauses — controlling visibility of menus, commands, keybindings, and UI elements.

### 4.1 Defining Context Keys

```typescript
const CONTEXT_CHAT_OPEN = new RawContextKey<boolean>("chatOpen", false);
const CONTEXT_SKIN_ID = new RawContextKey<string>("skinId", "default");
```

### 4.2 Binding and Updating

```typescript
const key = CONTEXT_CHAT_OPEN.bindTo(contextKeyService);
key.set(true);   // update
key.reset();      // reset to default
```

### 4.3 When Clauses (Expressions)

A full expression DSL for conditional logic:

```typescript
ContextKeyExpr.and(
  ContextKeyExpr.has("chatOpen"),
  ContextKeyExpr.equals("skinId", "pdf-refinery"),
  ContextKeyExpr.not("isDemo")
);
// serializes to: "chatOpen && skinId == 'pdf-refinery' && !isDemo"
```

Supports: `&&`, `||`, `!`, `==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `not in`, regex.

### 4.4 How It Drives UI

```typescript
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "myCommand",
      title: "Do Thing",
      precondition: ContextKeyExpr.has("isAdmin"),   // greyed out if false
      keybinding: {
        when: ContextKeyExpr.has("editorFocus"),      // shortcut only active here
        primary: KeyMod.CtrlCmd | KeyCode.KeyD,
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.has("isAdmin"),           // hidden from palette if false
      }],
    });
  }
});
```

**Surdej adoption:** Create a lightweight `ContextKeyService` in `@/core/context-keys/`:

- Define well-known keys: `isAuthenticated`, `isDemo`, `skinId`, `currentRoute`,
  `hasFeature.<flag>`, `sidebar.collapsed`, `palette.open`.
- Commands can declare `when` preconditions.
- Sidebar items are filtered by context key expressions.
- The command palette hides commands whose `when` evaluates false.

This replaces ad-hoc `if (isDemo)` checks scattered through components with a
centralized, declarative system.

---

## 5. registerAction2 — Unified Registration

This is VS Code's most elegant API. A single call registers a command, its keybinding, its
menu contributions, and its preconditions:

```typescript
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleSidebar",
      title: localize("toggleSidebar", "Toggle Sidebar"),
      category: "View",
      icon: Codicon.layoutSidebarLeft,
      f1: true,                          // show in command palette
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyB,
      },
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
      }],
      precondition: ContextKeyExpr.has("canToggleSidebar"),
    });
  }

  run(accessor: ServicesAccessor): void {
    const layoutService = accessor.get(ILayoutService);
    layoutService.toggleSidebar();
  }
});
```

This single declaration:
1. Registers the command handler
2. Adds it to the command palette (f1)
3. Binds `Cmd+B` as keyboard shortcut
4. Places it in the ViewTitle menu
5. Greyes it out when `canToggleSidebar` is false
6. Returns a disposable that cleans up all of the above

**Surdej adoption:** Create a `registerCommand()` helper that combines:
- Command registration
- Keyboard shortcut binding
- Palette inclusion
- Context key precondition
- Returns a single `Disposable`

This is an evolution of our current `CommandDefinition` type.

---

## 6. Event System — Emitter Pattern

VS Code's `Event` / `Emitter` is a disciplined alternative to Node EventEmitter:

```typescript
class MyService {
  private readonly _onDidChange = new Emitter<MyChangeEvent>();
  readonly onDidChange: Event<MyChangeEvent> = this._onDidChange.event;

  // Internal: fire event
  this._onDidChange.fire({ item: changedItem });
}

// Consumer:
const disposable = myService.onDidChange(event => { ... });
// Later: disposable.dispose() to unsubscribe
```

Key properties:
- **Typed** — generic `Event<T>` carries the payload type.
- **Disposable subscriptions** — `event(handler)` returns `IDisposable`.
- **No string event names** — compile-time safety.
- **Naming convention** — `onDid*` for after-the-fact, `onWill*` for before.

**Surdej adoption:** Create `@surdej/core/event` with `Emitter<T>` and `Event<T>`.
Use for: command registry changes, skin switches, auth state changes, feature flag updates.

---

## 7. Contribution Points — Declarative Extension

VS Code extensions declare capabilities in `package.json` (commands, menus, keybindings,
themes, views). The runtime reads these declarations and registers them.

### 7.1 The Pattern

```jsonc
// package.json contributes:
{
  "contributes": {
    "commands": [{ "command": "myExt.doThing", "title": "Do Thing" }],
    "menus": {
      "commandPalette": [{ "command": "myExt.doThing", "when": "editorFocus" }]
    },
    "keybindings": [{ "command": "myExt.doThing", "key": "ctrl+d" }]
  }
}
```

**Surdej adoption:** Domain modules should declare their contributions in a manifest:

```typescript
// domains/my-domain/manifest.ts
export const manifest: DomainManifest = {
  id: "my-domain",
  name: "My Domain",
  commands: [/* CommandDefinition[] */],
  sidebarItems: [/* SidebarItem[] */],
  routes: [/* RouteDefinition[] */],
  contextKeys: [/* ContextKeyDefinition[] */],
};
```

The core loader reads manifests, registers everything, and returns a combined `Disposable`.

---

## 8. Menu System — Typed Menu Locations

VS Code has ~100 typed `MenuId` constants — each representing a specific UI location:

```typescript
class MenuId {
  static readonly CommandPalette = new MenuId("CommandPalette");
  static readonly EditorTitle = new MenuId("EditorTitle");
  static readonly EditorContext = new MenuId("EditorContext");
  static readonly ViewTitle = new MenuId("ViewTitle");
  // ...
}
```

Commands are placed into menus via `MenuRegistry.appendMenuItem()`, with `when` clauses
controlling visibility per location.

**Surdej adoption:** Define typed menu locations for Surdej's UI:

```typescript
class MenuLocation {
  static readonly CommandPalette = "command-palette";
  static readonly SidebarMain = "sidebar-main";
  static readonly SidebarFooter = "sidebar-footer";
  static readonly ContextMenu = "context-menu";
  static readonly SettingsPage = "settings-page";
}
```

---

## 9. Activation Events — Lazy Module Loading

VS Code extensions activate lazily based on events:

```jsonc
{
  "activationEvents": [
    "onCommand:myExt.doThing",
    "onLanguage:typescript",
    "onView:myExtView"
  ]
}
```

The runtime only loads the extension when one of its activation events fires.

**Surdej adoption:** Domain modules can declare activation triggers:

```typescript
export const manifest: DomainManifest = {
  id: "laka-dispatch",
  activateOn: ["onCommand:domain.nexi.dispatch", "onRoute:/area/laka-dispatch"],
  // Module code is lazy-imported only when triggered
};
```

This keeps initial bundle size small — domain modules load on demand.

---

## 10. Summary: Adoption Priority

| Priority | Pattern | Effort | Impact |
|----------|---------|--------|--------|
| 🔴 P0 | **Disposable pattern** (`IDisposable`, `DisposableStore`, `toDisposable`) | Small | Prevents memory leaks everywhere |
| 🔴 P0 | **Commands return disposables** | Tiny | Enables domain module cleanup |
| 🟠 P1 | **Event system** (`Emitter<T>`, typed events, disposable subscriptions) | Small | Type-safe pub/sub across core |
| 🟠 P1 | **Context keys** (declarative `when` clauses for UI visibility) | Medium | Replaces scattered `if` checks |
| 🟡 P2 | **registerAction2 pattern** (unified command+keybinding+menu+precondition) | Medium | Single declaration for all command concerns |
| 🟡 P2 | **Domain manifests** (declarative contribution points) | Medium | Clean domain module boundaries |
| 🟢 P3 | **Activation events** (lazy domain module loading) | Large | Bundle size optimization |
| 🟢 P3 | **Typed menu locations** | Small | Compile-time safety for menu placement |
| ⚪ Defer | **Full DI** (decorator-based injection) | Large | React context is sufficient for now |

---

*Researched from: `microsoft/vscode` — `src/vs/platform/commands/common/commands.ts`,
`src/vs/base/common/lifecycle.ts`, `src/vs/platform/instantiation/`, `src/vs/platform/contextkey/`,
`src/vs/platform/actions/common/actions.ts`, `src/vs/workbench/services/commands/`.*
