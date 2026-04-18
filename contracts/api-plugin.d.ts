/**
 * API Plugin Contract
 *
 * Every API domain module must export a plugin conforming to this type.
 * The API server scans `src/domains/*/plugin.ts` at startup to auto-register routes.
 */

import type { FastifyInstance } from 'fastify';

export interface DomainPlugin {
  /** Plugin metadata */
  meta: DomainPluginMeta;

  /** Register function called by the API server */
  register: (app: FastifyInstance) => Promise<void>;
}

export interface DomainPluginMeta {
  /** Unique domain identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Plugin version (semver) */
  version: string;

  /** Route prefix (e.g. "/api/my-domain") */
  prefix: string;

  /** Required Prisma schema segments */
  schemas?: string[];

  /** Required NATS subjects */
  subjects?: string[];
}
