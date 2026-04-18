/**
 * Module: member-example — UI Components
 *
 * React components for the member-example module.
 * These are consumed by the frontend app via the domain manifest.
 *
 * All components use the shared Zod schemas for type inference,
 * ensuring the UI always matches the API contract.
 */

export { ExampleItemList } from './components/ExampleItemList.js';
export { ExampleItemForm } from './components/ExampleItemForm.js';
export { useModuleApi } from './hooks/useModuleApi.js';
