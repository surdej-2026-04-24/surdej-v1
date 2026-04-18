# @happy-pdf-refinery/mixin-sdk

SDK for building iframe mixin tools that integrate with the Surdej platform.

## Installation

```bash
npm install @happy-pdf-refinery/mixin-sdk
```

Add to your project's `.npmrc`:

```
@happy-pdf-refinery:registry=https://npm.pkg.github.com
```

## Quick Start

```ts
import { SurdejMixinClient } from '@happy-pdf-refinery/mixin-sdk';

const client = new SurdejMixinClient();

// Connect to the Surdej host (waits for handshake)
await client.connect();

// Check granted permissions
console.log(client.permissions); // ['bridge:read', 'kv:readwrite']

// Use the page content bridge
const pageInfo = await client.bridge.getPageInfo();
console.log(pageInfo.url, pageInfo.title);

// Use the per-user KV store
await client.kv.set('last-visited', { url: pageInfo.url });
const saved = await client.kv.get('last-visited');

// Use the NoSQL API (if permitted)
const collections = await client.nosql.listCollections();
```

## Available APIs

### Bridge (page content)

Requires `bridge:read` or `bridge:readwrite` permission.

| Method | Permission | Description |
|--------|-----------|-------------|
| `bridge.getPageInfo()` | read | Get current page URL, title, OG metadata |
| `bridge.getPageText()` | read | Get full page text content |
| `bridge.getSelection()` | read | Get user's text selection |
| `bridge.getSnapshot()` | read | Get full page snapshot |
| `bridge.querySelector(sel)` | read | Query a DOM element |
| `bridge.querySelectorAll(sel)` | read | Query multiple DOM elements |
| `bridge.click(sel)` | readwrite | Click a DOM element |
| `bridge.fill(sel, val)` | readwrite | Fill an input field |
| `bridge.fetchPage(url)` | readwrite | Fetch a URL via host |

### NoSQL

Requires `nosql:read` or `nosql:readwrite` permission.

| Method | Permission | Description |
|--------|-----------|-------------|
| `nosql.listCollections()` | read | List collections |
| `nosql.getCollection(id)` | read | Get collection details |
| `nosql.listDocuments(colId)` | read | List documents in collection |
| `nosql.getDocument(id)` | read | Get single document |
| `nosql.createCollection(...)` | readwrite | Create a collection |
| `nosql.createDocument(...)` | readwrite | Create a document |
| `nosql.updateDocument(...)` | readwrite | Update a document |
| `nosql.deleteDocument(id)` | readwrite | Delete a document |

### Key/Value Store

Requires `kv:read` or `kv:readwrite` permission. Data is scoped per user and mixin.

| Method | Permission | Description |
|--------|-----------|-------------|
| `kv.get(key)` | read | Get a value by key |
| `kv.list(prefix?)` | read | List entries, optionally by prefix |
| `kv.set(key, value)` | readwrite | Set a key/value pair |
| `kv.delete(key)` | readwrite | Delete a key |

### Meta

| Method | Description |
|--------|-------------|
| `ping()` | Health check |
| `getContext()` | Get user/tenant/mixin context |
| `client.connected` | Connection status |
| `client.permissions` | Granted permissions |
| `client.context` | Current context |

## Permissions

When registering an iframe tool in Surdej, declare which permissions it needs:

```
bridge:read       - Page content bridge (read-only)
bridge:readwrite  - Page content bridge (read + write)
nosql:read        - NoSQL API (read-only)
nosql:readwrite   - NoSQL API (read + write)
kv:read           - Mixin KV store (read-only)
kv:readwrite      - Mixin KV store (read + write)
```

Only granted permissions will be available at runtime. Requesting an action
without the required permission will throw an error.

## License

MIT
