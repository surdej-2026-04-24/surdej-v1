/**
 * vite-plugin-surdej-domains
 *
 * Scans src/domains/STAR/manifest.ts at build time, validates each
 * manifest against the DomainManifest contract, and generates a
 * virtual module "virtual:surdej-domains" that exports the full
 * DomainRegistry.
 *
 * Also discovers topology definitions from:
 *   domains/NAME/topologies/STAR.ts
 *   domains/NAME/topologies/STAR.generated.ts
 */
import { type Plugin } from 'vite';
interface Options {
    domainsDir?: string;
    verbose?: boolean;
}
export declare function surdejDomains(options?: Options): Plugin;
export default surdejDomains;
