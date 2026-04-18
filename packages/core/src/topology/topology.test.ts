import { describe, it, expect } from 'vitest';
import {
    flattenNodes,
    findNodeById,
    getNodeBreadcrumb,
    countNodes,
    validateTopology,
} from './topology.js';
import type { TopologyLayer, TopologyConnection } from './topology.js';

const testLayers: TopologyLayer[] = [
    {
        id: 'dev',
        label: 'Development',
        visible: true,
        nodes: [
            {
                id: 'monorepo',
                label: 'Monorepo',
                description: 'pnpm workspace',
                color: 'from-blue-500/20',
                level: 0,
                children: [
                    {
                        id: 'frontend',
                        label: 'Frontend',
                        description: 'React app',
                        color: 'from-cyan-500/20',
                        level: 1,
                    },
                    {
                        id: 'api',
                        label: 'API',
                        description: 'Fastify server',
                        color: 'from-green-500/20',
                        level: 1,
                        children: [
                            {
                                id: 'prisma',
                                label: 'Prisma',
                                description: 'ORM',
                                color: 'from-purple-500/20',
                                level: 2,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'prod',
        label: 'Production',
        visible: true,
        nodes: [
            {
                id: 'aks',
                label: 'AKS',
                description: 'Kubernetes',
                color: 'from-orange-500/20',
                level: 0,
            },
        ],
    },
];

const testConnections: TopologyConnection[] = [
    { from: 'frontend', to: 'api', label: 'HTTP' },
    { from: 'api', to: 'aks', label: 'Deploy', animated: true },
];

describe('flattenNodes', () => {
    it('should flatten all nested nodes', () => {
        const flat = flattenNodes(testLayers);
        expect(flat.map((n) => n.id)).toEqual(['monorepo', 'frontend', 'api', 'prisma', 'aks']);
    });

    it('should return empty array for empty layers', () => {
        expect(flattenNodes([])).toEqual([]);
    });
});

describe('findNodeById', () => {
    it('should find top-level node', () => {
        const node = findNodeById(testLayers, 'monorepo');
        expect(node?.label).toBe('Monorepo');
    });

    it('should find deeply nested node', () => {
        const node = findNodeById(testLayers, 'prisma');
        expect(node?.label).toBe('Prisma');
    });

    it('should find node in second layer', () => {
        const node = findNodeById(testLayers, 'aks');
        expect(node?.label).toBe('AKS');
    });

    it('should return undefined for missing node', () => {
        expect(findNodeById(testLayers, 'nonexistent')).toBeUndefined();
    });
});

describe('getNodeBreadcrumb', () => {
    it('should return breadcrumb for nested node', () => {
        const crumb = getNodeBreadcrumb(testLayers, 'prisma');
        expect(crumb.map((c) => c.label)).toEqual(['Development', 'Monorepo', 'API', 'Prisma']);
    });

    it('should return breadcrumb for top-level node', () => {
        const crumb = getNodeBreadcrumb(testLayers, 'monorepo');
        expect(crumb.map((c) => c.label)).toEqual(['Development', 'Monorepo']);
    });

    it('should return empty for missing node', () => {
        expect(getNodeBreadcrumb(testLayers, 'nonexistent')).toEqual([]);
    });
});

describe('countNodes', () => {
    it('should count all nodes including nested', () => {
        expect(countNodes(testLayers)).toBe(5);
    });
});

describe('validateTopology', () => {
    it('should return no errors for valid topology', () => {
        const errors = validateTopology({
            id: 'test',
            layers: testLayers,
            connections: testConnections,
        });
        expect(errors).toEqual([]);
    });

    it('should detect invalid connection sources', () => {
        const errors = validateTopology({
            id: 'test',
            layers: testLayers,
            connections: [{ from: 'unknown', to: 'api' }],
        });
        expect(errors).toContain('Connection references unknown source: "unknown"');
    });

    it('should detect invalid connection targets', () => {
        const errors = validateTopology({
            id: 'test',
            layers: testLayers,
            connections: [{ from: 'api', to: 'unknown' }],
        });
        expect(errors).toContain('Connection references unknown target: "unknown"');
    });

    it('should detect duplicate node IDs', () => {
        const duplicateLayers: TopologyLayer[] = [
            {
                id: 'layer',
                label: 'Layer',
                visible: true,
                nodes: [
                    { id: 'dup', label: 'A', description: '', color: '', level: 0 },
                    { id: 'dup', label: 'B', description: '', color: '', level: 0 },
                ],
            },
        ];
        const errors = validateTopology({
            id: 'test',
            layers: duplicateLayers,
            connections: [],
        });
        expect(errors).toContain('Duplicate node ID: "dup"');
    });

    it('should allow connections to actors', () => {
        const errors = validateTopology({
            id: 'test',
            layers: testLayers,
            connections: [{ from: 'developer', to: 'monorepo' }],
            actors: [{ id: 'developer' }],
        });
        expect(errors).toEqual([]);
    });
});
