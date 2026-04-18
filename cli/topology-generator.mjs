#!/usr/bin/env node
/**
 * Surdej CLI — Topology Generator (Phase 8.11)
 *
 * Scans project structure and generates TopologyDefinition files.
 *
 * Generators:
 *   topology:infra   — Infrastructure topology from docker-compose, k8s manifests
 *   topology:code    — Codebase topology from package.json, tsconfig, src/
 *   topology:data    — Data-flow topology from Prisma schemas + NATS subjects
 *
 * Usage:
 *   node cli/topology-generator.mjs infra  [--domain my-domain]  [--out path]
 *   node cli/topology-generator.mjs code   [--domain my-domain]  [--out path]
 *   node cli/topology-generator.mjs data   [--domain my-domain]  [--out path]
 *
 * The generated .ts file is written to:
 *   apps/frontend/src/domains/<domain>/topologies/<type>.generated.ts
 * or to the path specified by --out.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';

// ─── CLI args ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const generatorType = args[0]; // "infra" | "code" | "data"

function getFlag(name) {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : undefined;
}

const domain = getFlag('domain') ?? 'platform';
const outPath = getFlag('out');
const ROOT = resolve(import.meta.dirname ?? '.', '..');

function heading(text) {
    console.log(`\n\x1b[1m\x1b[36m▸ ${text}\x1b[0m\n`);
}
function success(text) {
    console.log(`  \x1b[32m✓\x1b[0m ${text}`);
}
function warn(text) {
    console.log(`  \x1b[33m⚠\x1b[0m ${text}`);
}
function error(text) {
    console.error(`  \x1b[31m✗\x1b[0m ${text}`);
}

// ─── Infrastructure Topology Generator ─────────────────────────

function generateInfraTopology() {
    heading(`Generating infrastructure topology for: ${domain}`);

    const composePath = join(ROOT, 'docker-compose.yml');
    const k8sDir = join(ROOT, 'infra', 'k8s');

    const devNodes = [];
    const prodNodes = [];
    const connections = [];

    // Parse docker-compose.yml for dev nodes
    if (existsSync(composePath)) {
        const yaml = readFileSync(composePath, 'utf-8');
        const serviceMatches = yaml.matchAll(/^\s{2}(\S+):/gm);

        for (const match of serviceMatches) {
            const name = match[1];
            if (name.startsWith('#') || name === 'volumes') continue;

            const portMatch = yaml.match(new RegExp(`${name}:[\\s\\S]*?ports:[\\s\\S]*?- "?(?:127\\.0\\.0\\.1:)?(\\d+):\\d+"?`, 'm'));
            const imageMatch = yaml.match(new RegExp(`${name}:[\\s\\S]*?image: (\\S+)`, 'm'));
            const port = portMatch?.[1] ?? '—';
            const image = imageMatch?.[1] ?? 'custom';

            let icon = 'Box';
            let color = 'from-gray-500 to-slate-500';
            if (name.includes('postgres')) { icon = 'Database'; color = 'from-sky-500 to-blue-500'; }
            else if (name.includes('nats')) { icon = 'Radio'; color = 'from-green-500 to-emerald-500'; }
            else if (name.includes('redis')) { icon = 'Zap'; color = 'from-red-500 to-rose-500'; }
            else if (name.includes('api')) { icon = 'Server'; color = 'from-emerald-500 to-teal-500'; }
            else if (name.includes('worker')) { icon = 'Cog'; color = 'from-amber-500 to-orange-500'; }
            else if (name.includes('prometheus') || name.includes('grafana') || name.includes('loki')) {
                icon = 'Activity'; color = 'from-purple-500 to-violet-500';
            }

            devNodes.push({
                id: `dev-${name}`,
                label: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                icon,
                description: `Docker service: ${name} (${image})`,
                color,
                level: 0,
                properties: [
                    { key: 'Image', value: image },
                    { key: 'Port', value: port, copyable: true },
                ],
                tags: ['dev', 'docker', name],
            });
        }
        success(`Parsed ${devNodes.length} services from docker-compose.yml`);
    } else {
        warn('docker-compose.yml not found — skipping dev layer');
    }

    // Parse k8s manifests for prod nodes
    if (existsSync(k8sDir)) {
        const files = readdirSync(k8sDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
        for (const file of files) {
            const content = readFileSync(join(k8sDir, file), 'utf-8');
            const kindMatch = content.match(/kind:\s*(\S+)/);
            const nameMatch = content.match(/name:\s*(\S+)/);
            const kind = kindMatch?.[1] ?? 'Resource';
            const name = nameMatch?.[1] ?? basename(file, '.yml');

            let icon = 'Cloud';
            let color = 'from-blue-600 to-indigo-600';
            if (kind === 'Deployment') { icon = 'Rocket'; color = 'from-emerald-600 to-teal-600'; }
            else if (kind === 'Service') { icon = 'Globe'; color = 'from-sky-600 to-blue-600'; }
            else if (kind === 'Ingress') { icon = 'ArrowRight'; color = 'from-orange-500 to-amber-500'; }
            else if (kind === 'ConfigMap') { icon = 'FileText'; color = 'from-gray-500 to-gray-600'; }
            else if (kind === 'Secret') { icon = 'Lock'; color = 'from-red-600 to-rose-600'; }

            prodNodes.push({
                id: `k8s-${name}`,
                label: `${kind}: ${name}`,
                icon,
                description: `K8s ${kind} from ${file}`,
                color,
                level: 0,
                properties: [
                    { key: 'Kind', value: kind },
                    { key: 'Manifest', value: `infra/k8s/${file}` },
                ],
                tags: ['prod', 'k8s', kind.toLowerCase()],
            });
        }
        success(`Parsed ${prodNodes.length} K8s resources from infra/k8s/`);
    } else {
        warn('infra/k8s/ not found — skipping prod layer');
    }

    // Auto-detect connections
    if (devNodes.some(n => n.id.includes('api')) && devNodes.some(n => n.id.includes('postgres'))) {
        connections.push({ from: devNodes.find(n => n.id.includes('api')).id, to: devNodes.find(n => n.id.includes('postgres')).id, label: 'Prisma', animated: true });
    }
    if (devNodes.some(n => n.id.includes('api')) && devNodes.some(n => n.id.includes('nats'))) {
        connections.push({ from: devNodes.find(n => n.id.includes('api')).id, to: devNodes.find(n => n.id.includes('nats')).id, label: 'publish', animated: true });
    }
    if (devNodes.some(n => n.id.includes('api')) && devNodes.some(n => n.id.includes('redis'))) {
        connections.push({ from: devNodes.find(n => n.id.includes('api')).id, to: devNodes.find(n => n.id.includes('redis')).id, label: 'cache' });
    }
    for (const node of devNodes.filter(n => n.id.includes('worker'))) {
        const natsNode = devNodes.find(n => n.id.includes('nats'));
        const pgNode = devNodes.find(n => n.id.includes('postgres'));
        if (natsNode) connections.push({ from: natsNode.id, to: node.id, label: 'subscribe', animated: true });
        if (pgNode) connections.push({ from: node.id, to: pgNode.id, label: 'Prisma' });
    }

    const topology = {
        id: `${domain}-infrastructure`,
        type: 'infrastructure',
        name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Infrastructure`,
        description: `Auto-generated infrastructure topology for ${domain}`,
        icon: 'Network',
        commandId: `navigate.topology.${domain}-infrastructure`,
        generatedAt: new Date().toISOString(),
        generatedBy: `cli:topology:infra --domain ${domain}`,
        layers: [
            { id: 'dev', label: 'Development', icon: 'Code2', visible: true, nodes: devNodes },
            ...(prodNodes.length > 0 ? [{ id: 'prod', label: 'Production', icon: 'Rocket', visible: true, nodes: prodNodes }] : []),
        ],
        actors: [
            { id: `${domain}-developer`, label: 'Developer', icon: 'User', description: 'Developer interacting with the platform', color: 'from-cyan-500 to-blue-500' },
        ],
        connections,
    };

    return topology;
}

// ─── Codebase Topology Generator ───────────────────────────────

function generateCodeTopology() {
    heading(`Generating codebase topology for: ${domain}`);

    const layers = [];
    const connections = [];

    // Scan packages
    const pkgDir = join(ROOT, 'packages');
    if (existsSync(pkgDir)) {
        const pkgNodes = [];
        for (const dir of readdirSync(pkgDir)) {
            const pkgJsonPath = join(pkgDir, dir, 'package.json');
            if (!existsSync(pkgJsonPath)) continue;
            const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

            const srcDir = join(pkgDir, dir, 'src');
            const fileCount = existsSync(srcDir)
                ? readdirSync(srcDir, { recursive: true }).filter(f => f.endsWith('.ts') || f.endsWith('.tsx')).length
                : 0;

            pkgNodes.push({
                id: `pkg-${dir}`,
                label: pkg.name ?? `@surdej/${dir}`,
                icon: 'Package',
                description: `Shared package: ${pkg.name}`,
                color: 'from-violet-500 to-purple-600',
                level: 0,
                properties: [
                    { key: 'Version', value: pkg.version ?? '0.0.0' },
                    { key: 'Files', value: String(fileCount) },
                    { key: 'Path', value: `packages/${dir}`, copyable: true },
                ],
                tags: ['package', dir],
            });
        }
        layers.push({ id: 'packages', label: 'Packages', icon: 'Package', visible: true, nodes: pkgNodes });
        success(`Found ${pkgNodes.length} packages`);
    }

    // Scan apps
    const appsDir = join(ROOT, 'apps');
    if (existsSync(appsDir)) {
        const appNodes = [];
        for (const dir of readdirSync(appsDir)) {
            const pkgJsonPath = join(appsDir, dir, 'package.json');
            if (!existsSync(pkgJsonPath)) continue;
            const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

            let icon = 'Box';
            let color = 'from-gray-500 to-slate-500';
            if (dir === 'frontend') { icon = 'Monitor'; color = 'from-blue-500 to-indigo-500'; }
            else if (dir === 'api') { icon = 'Server'; color = 'from-emerald-500 to-teal-500'; }
            else if (dir === 'helper') { icon = 'Wrench'; color = 'from-amber-500 to-orange-500'; }
            else if (dir === 'extension') { icon = 'Puzzle'; color = 'from-pink-500 to-rose-500'; }

            appNodes.push({
                id: `app-${dir}`,
                label: pkg.name ?? dir,
                icon,
                description: `Application: ${dir}`,
                color,
                level: 0,
                properties: [
                    { key: 'Path', value: `apps/${dir}`, copyable: true },
                ],
                tags: ['app', dir],
            });

            // Connect apps to packages they depend on
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            for (const [dep] of Object.entries(deps)) {
                if (dep.startsWith('@surdej/')) {
                    const pkgName = dep.replace('@surdej/', '');
                    connections.push({ from: `app-${dir}`, to: `pkg-${pkgName}`, label: 'depends', style: 'dashed' });
                }
            }
        }
        layers.push({ id: 'apps', label: 'Applications', icon: 'AppWindow', visible: true, nodes: appNodes });
        success(`Found ${appNodes.length} apps`);
    }

    // Scan workers
    const workersDir = join(ROOT, 'workers');
    if (existsSync(workersDir)) {
        const workerNodes = [];
        for (const dir of readdirSync(workersDir)) {
            if (dir.startsWith('.') || dir === '_template') continue;
            const pkgJsonPath = join(workersDir, dir, 'package.json');
            if (!existsSync(pkgJsonPath)) continue;
            const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

            workerNodes.push({
                id: `worker-${dir}`,
                label: pkg.name ?? dir,
                icon: 'Cog',
                description: `Worker: ${dir}`,
                color: 'from-amber-500 to-orange-500',
                level: 0,
                properties: [
                    { key: 'Path', value: `workers/${dir}`, copyable: true },
                ],
                tags: ['worker', dir],
            });

            // Connect workers to packages
            const deps = { ...pkg.dependencies };
            for (const [dep] of Object.entries(deps)) {
                if (dep.startsWith('@surdej/')) {
                    const pkgName = dep.replace('@surdej/', '');
                    connections.push({ from: `worker-${dir}`, to: `pkg-${pkgName}`, label: 'depends', style: 'dashed' });
                }
            }
        }
        layers.push({ id: 'workers', label: 'Workers', icon: 'Cog', visible: true, nodes: workerNodes });
        success(`Found ${workerNodes.length} workers`);
    }

    return {
        id: `${domain}-codebase`,
        type: 'codebase',
        name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Codebase`,
        description: `Auto-generated codebase topology for ${domain} — packages, apps, workers and their dependency graph.`,
        icon: 'Code2',
        commandId: `navigate.topology.${domain}-codebase`,
        generatedAt: new Date().toISOString(),
        generatedBy: `cli:topology:code --domain ${domain}`,
        layers,
        connections,
    };
}

// ─── Data Flow Topology Generator ──────────────────────────────

function generateDataFlowTopology() {
    heading(`Generating data-flow topology for: ${domain}`);

    const nodes = [];
    const connections = [];

    // Scan Prisma schemas
    const schemas = [];
    const scanPrisma = (dir) => {
        if (!existsSync(dir)) return;
        const files = readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.prisma'));
        for (const file of files) {
            const content = readFileSync(join(dir, file), 'utf-8');
            const models = [...content.matchAll(/^model\s+(\w+)/gm)].map(m => m[1]);
            schemas.push({ file: file.toString(), models });
        }
    };
    scanPrisma(join(ROOT, 'apps', 'api', 'prisma'));
    scanPrisma(join(ROOT, 'workers'));

    for (const schema of schemas) {
        const schemaName = basename(schema.file, '.prisma');
        const modelChildren = schema.models.map((model, i) => ({
            id: `model-${schemaName}-${model}`,
            label: model,
            icon: 'Table',
            description: `Prisma model: ${model}`,
            color: 'from-sky-400 to-blue-400',
            level: 1,
            tags: ['prisma', 'model', model.toLowerCase()],
        }));

        nodes.push({
            id: `schema-${schemaName}`,
            label: `Schema: ${schemaName}`,
            icon: 'Database',
            description: `Prisma schema ${schema.file} — ${schema.models.length} models`,
            color: 'from-sky-500 to-blue-600',
            level: 0,
            children: modelChildren,
            properties: [
                { key: 'File', value: schema.file, copyable: true },
                { key: 'Models', value: String(schema.models.length) },
            ],
            tags: ['prisma', 'schema'],
        });
    }
    success(`Found ${schemas.length} Prisma schemas with ${schemas.reduce((s, sc) => s + sc.models.length, 0)} models`);

    // Add NATS subjects node
    nodes.push({
        id: 'nats-bus',
        label: 'NATS JetStream',
        icon: 'Radio',
        description: 'Message bus for job dispatch and events',
        color: 'from-green-500 to-emerald-500',
        level: 0,
        properties: [
            { key: 'Subjects', value: 'job.>, worker.*, event.>, dlq.>' },
        ],
        tags: ['nats', 'messaging'],
    });

    // Connect schemas via foreign keys / NATS
    for (const schema of schemas) {
        connections.push({
            from: 'nats-bus',
            to: `schema-${basename(schema.file, '.prisma')}`,
            label: 'triggers',
            animated: true,
        });
    }

    return {
        id: `${domain}-data-flow`,
        type: 'data-flow',
        name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Data Flow`,
        description: `Auto-generated data-flow topology — Prisma schemas, models, and NATS message bus.`,
        icon: 'GitBranch',
        commandId: `navigate.topology.${domain}-data-flow`,
        generatedAt: new Date().toISOString(),
        generatedBy: `cli:topology:data --domain ${domain}`,
        layers: [
            { id: 'data', label: 'Data Stores', icon: 'Database', visible: true, nodes },
        ],
        connections,
    };
}

// ─── Serialise & Write ─────────────────────────────────────────

function writeTopology(topology) {
    const varName = topology.id
        .toUpperCase()
        .replace(/-/g, '_');

    const code = `/**
 * ${topology.name}
 *
 * ${topology.description}
 *
 * @generated by ${topology.generatedBy}
 * @generatedAt ${topology.generatedAt}
 */
import type { TopologyDefinition } from '@surdej/core';

export const ${varName}: TopologyDefinition = ${JSON.stringify(topology, null, 4)};
`;

    const outputPath =
        outPath ??
        join(ROOT, 'apps', 'frontend', 'src', 'domains', domain, 'topologies', `${topology.type}.generated.ts`);

    writeFileSync(outputPath, code, 'utf-8');
    success(`Written: ${outputPath}`);
    console.log(`  Topology: ${topology.id}`);
    console.log(`  Layers: ${topology.layers.length}`);
    console.log(`  Nodes: ${topology.layers.reduce((s, l) => s + l.nodes.length, 0)}`);
    console.log(`  Connections: ${topology.connections.length}`);
}

// ─── Main ──────────────────────────────────────────────────────

const GENERATORS = {
    infra: generateInfraTopology,
    code: generateCodeTopology,
    data: generateDataFlowTopology,
};

if (!generatorType || generatorType === 'help') {
    heading('Surdej Topology Generator');
    console.log('  Usage: node cli/topology-generator.mjs <type> [--domain <name>] [--out <path>]');
    console.log('');
    console.log('  Types:');
    console.log('    infra  — Infrastructure topology from docker-compose + k8s');
    console.log('    code   — Codebase topology from package.json + src/');
    console.log('    data   — Data-flow topology from Prisma schemas + NATS');
    console.log('');
    console.log('  Examples:');
    console.log('    node cli/topology-generator.mjs infra --domain my-domain');
    console.log('    node cli/topology-generator.mjs code --domain platform');
    console.log('    node cli/topology-generator.mjs data --out ./output.ts');
    process.exit(0);
}

const generator = GENERATORS[generatorType];
if (!generator) {
    error(`Unknown generator type: ${generatorType}`);
    console.log('  Available: infra, code, data');
    process.exit(1);
}

try {
    const topology = generator();
    writeTopology(topology);
    console.log('');
    success('Done!');
} catch (e) {
    error(e.message);
    process.exit(1);
}
