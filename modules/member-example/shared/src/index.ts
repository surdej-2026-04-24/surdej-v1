/**
 * Module: member-example — Shared DTOs
 *
 * Zod schemas used by both the module worker (API validation)
 * and the frontend UI (form validation, type inference).
 *
 * Convention:
 *   - Export Zod schemas as `XxxSchema`
 *   - Export inferred types as `Xxx`
 *   - Export request/response DTOs as `XxxRequest` / `XxxResponse`
 */

export {
    // Schemas
    ExampleItemSchema,
    CreateExampleItemSchema,
    UpdateExampleItemSchema,
    ExampleItemListResponseSchema,
    // Types
    type ExampleItem,
    type CreateExampleItem,
    type UpdateExampleItem,
    type ExampleItemListResponse,
    // Constants
    MODULE_NAME,
    NATS_SUBJECTS,
} from './schemas.js';
