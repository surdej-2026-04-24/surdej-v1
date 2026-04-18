/**
 * Sample topology data for the Surdej platform architecture.
 * In production, these would come from CLI generators or domain manifests.
 */
import type {
    TopologyDefinition,
    TopologyNode,
} from '@surdej/core';

// Domain topologies can be registered here


const devNodes: TopologyNode[] = [
    {
        id: 'monorepo',
        label: 'Monorepo',
        icon: 'FolderGit2',
        description: 'pnpm workspace root managing all packages, apps, and workers',
        color: 'from-blue-500 to-cyan-500',
        level: 0,
        properties: [
            { key: 'Manager', value: 'pnpm 10.x', copyable: true },
            { key: 'Language', value: 'TypeScript 5.9' },
            { key: 'Framework', value: 'React 19 + Vite 7' },
        ],
        tags: ['root', 'pnpm'],
        children: [
            {
                id: 'app-frontend',
                label: 'Frontend',
                icon: 'Monitor',
                description: 'Vite + React SPA with shadcn/ui, command system, and skin engine',
                color: 'from-violet-500 to-purple-600',
                level: 1,
                properties: [
                    { key: 'Port', value: '4001', copyable: true },
                    { key: 'Framework', value: 'Vite 7 + React 19' },
                    { key: 'UI', value: 'shadcn/ui + Tailwind CSS 4' },
                    { key: 'Build', value: 'vite build' },
                ],
                tags: ['app', 'frontend', 'react', 'vite'],
            },
            {
                id: 'app-api',
                label: 'API Server',
                icon: 'Server',
                description: 'Fastify REST API with Prisma, JWT auth, and domain plugin discovery',
                color: 'from-emerald-500 to-teal-500',
                level: 1,
                properties: [
                    { key: 'Port', value: '5001', copyable: true },
                    { key: 'Framework', value: 'Fastify 5' },
                    { key: 'ORM', value: 'Prisma 6' },
                    { key: 'Auth', value: 'JWT / Entra / Demo' },
                ],
                tags: ['app', 'api', 'fastify', 'prisma'],
            },
            {
                id: 'app-helper',
                label: 'Helper Server',
                icon: 'Wrench',
                description: 'Express dev bridge — opens files in VS Code, reads filesystem',
                color: 'from-amber-500 to-orange-500',
                level: 1,
                properties: [
                    { key: 'Port', value: '3847', copyable: true },
                    { key: 'Purpose', value: 'Dev-only editor bridge' },
                ],
                tags: ['app', 'helper', 'dev-only'],
            },
        ],
    },
    {
        id: 'docker-postgres',
        label: 'PostgreSQL',
        icon: 'Database',
        description: 'pgvector-enabled PostgreSQL for data and vector storage',
        color: 'from-sky-500 to-blue-500',
        level: 0,
        properties: [
            { key: 'Image', value: 'pgvector/pgvector:pg15', copyable: true },
            { key: 'Port', value: '5434', copyable: true },
            { key: 'Extensions', value: 'pgvector, uuid-ossp' },
        ],
        tags: ['docker', 'database', 'postgres'],
    },
    {
        id: 'docker-nats',
        label: 'NATS',
        icon: 'Radio',
        description: 'NATS JetStream message broker for worker job distribution',
        color: 'from-green-500 to-emerald-500',
        level: 0,
        properties: [
            { key: 'Image', value: 'nats:2.10-alpine', copyable: true },
            { key: 'Client Port', value: '4224', copyable: true },
            { key: 'Monitor Port', value: '8224', copyable: true },
        ],
        tags: ['docker', 'messaging', 'nats'],
    },
];

const prodNodes: TopologyNode[] = [
    {
        id: 'cloudflare',
        label: 'Cloudflare',
        icon: 'Shield',
        description: 'WAF, DNS, CDN, and Zero Trust tunnel for AKS ingress',
        color: 'from-orange-500 to-amber-500',
        level: 0,
        properties: [
            { key: 'Services', value: 'DNS, WAF, Tunnel, Access' },
            { key: 'Protocol', value: 'HTTPS / HTTP/3' },
        ],
        tags: ['prod', 'cloudflare', 'cdn'],
    },
    {
        id: 'aks-cluster',
        label: 'AKS Cluster',
        icon: 'Cloud',
        description: 'Azure Kubernetes Service hosting all production workloads',
        color: 'from-blue-600 to-indigo-600',
        level: 0,
        properties: [
            { key: 'Provider', value: 'Azure (AKS)' },
            { key: 'Region', value: 'West Europe' },
            { key: 'Node Pool', value: 'Standard_D4s_v3' },
        ],
        tags: ['prod', 'kubernetes', 'azure'],
        children: [
            {
                id: 'k8s-api',
                label: 'API Deployment',
                icon: 'Server',
                description: 'API server pod(s) running behind ClusterIP service',
                color: 'from-emerald-500 to-teal-500',
                level: 1,
                properties: [
                    { key: 'Replicas', value: '2' },
                    { key: 'Memory', value: '128Mi–512Mi' },
                    { key: 'CPU', value: '100m–500m' },
                ],
                tags: ['k8s', 'deployment', 'api'],
            },
            {
                id: 'k8s-frontend',
                label: 'Frontend Deployment',
                icon: 'Monitor',
                description: 'Static SPA served via Nginx pod',
                color: 'from-violet-500 to-purple-600',
                level: 1,
                properties: [
                    { key: 'Replicas', value: '2' },
                    { key: 'Memory', value: '64Mi–256Mi' },
                ],
                tags: ['k8s', 'deployment', 'frontend'],
            },
        ],
    },
    {
        id: 'azure-services',
        label: 'Azure Services',
        icon: 'Cloud',
        description: 'Managed Azure resources (Key Vault, Storage, Container Registry)',
        color: 'from-sky-500 to-blue-600',
        level: 0,
        properties: [
            { key: 'Key Vault', value: 'Secret management' },
            { key: 'Storage', value: 'Blob storage for documents' },
            { key: 'ACR', value: 'Container registry (GHCR primary)' },
        ],
        tags: ['prod', 'azure', 'managed'],
    },
];

const pkgNodes: TopologyNode[] = [
    {
        id: 'pkg-core',
        label: '@surdej/core',
        icon: 'Package',
        description: 'Shared types, lifecycle (Disposable, Emitter), topology utilities',
        color: 'from-pink-500 to-rose-500',
        level: 0,
        properties: [
            { key: 'Exports', value: 'lifecycle, event, topology, features' },
            { key: 'Size', value: '~12KB (minified)' },
        ],
        tags: ['package', 'core', 'types'],
    },
];

export const SURDEJ_ARCHITECTURE: TopologyDefinition = {
    id: 'surdej-architecture',
    type: 'infrastructure',
    name: 'Surdej Architecture',
    description: 'Platform infrastructure topology showing development and production environments',
    icon: 'Network',
    commandId: 'navigate.topology.surdej-architecture',
    generatedAt: new Date().toISOString(),
    generatedBy: 'manual',
    layers: [
        {
            id: 'dev',
            label: 'Development',
            icon: 'Code2',
            visible: true,
            nodes: devNodes,
        },
        {
            id: 'prod',
            label: 'Production',
            icon: 'Rocket',
            visible: true,
            nodes: prodNodes,
        },
        {
            id: 'packages',
            label: 'Packages',
            icon: 'Package',
            visible: true,
            nodes: pkgNodes,
        },
    ],
    actors: [
        {
            id: 'actor-developer',
            label: 'Developer',
            icon: 'User',
            description: 'Platform developer working on the Surdej monorepo',
            color: 'from-cyan-500 to-blue-500',
        },
        {
            id: 'actor-enduser',
            label: 'End User',
            icon: 'Users',
            description: 'Application user accessing via the browser',
            color: 'from-green-500 to-emerald-500',
        },
    ],
    connections: [
        { from: 'actor-developer', to: 'monorepo', label: 'Develops', style: 'dashed' },
        { from: 'actor-enduser', to: 'cloudflare', label: 'HTTPS', animated: true },
        { from: 'cloudflare', to: 'aks-cluster', label: 'Tunnel', animated: true },
        { from: 'app-frontend', to: 'app-api', label: 'REST API', animated: true },
        { from: 'app-api', to: 'docker-postgres', label: 'Prisma', animated: true },
        { from: 'app-api', to: 'docker-nats', label: 'JetStream', animated: true },
        { from: 'k8s-api', to: 'azure-services', label: 'SDK' },
        { from: 'k8s-frontend', to: 'k8s-api', label: 'REST API', animated: true },
    ],
};

/** All demo topologies */
export const DEMO_TOPOLOGIES: TopologyDefinition[] = [
    SURDEJ_ARCHITECTURE,
];
