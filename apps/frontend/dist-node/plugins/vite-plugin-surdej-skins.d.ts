/**
 * vite-plugin-surdej-skins
 *
 * Scans src/skins/STAR/manifest.ts at build time and generates
 * a virtual module "virtual:surdej-skins" that exports all
 * discovered skin definitions.
 */
import { type Plugin } from 'vite';
interface Options {
    skinsDir?: string;
    verbose?: boolean;
}
export declare function surdejSkins(options?: Options): Plugin;
export default surdejSkins;
