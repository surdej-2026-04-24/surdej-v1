import { describe, it, expect } from 'vitest';
import { validateDomainManifest } from './domains.js';

describe('validateDomainManifest', () => {
    it('should accept a valid manifest', () => {
        const errors = validateDomainManifest({
            id: 'my-domain',
            name: 'My Domain',
            description: 'A test domain',
        });
        expect(errors).toEqual([]);
    });

    it('should accept a manifest with all fields', () => {
        const errors = validateDomainManifest({
            id: 'full-domain',
            name: 'Full Domain',
            description: 'Fully loaded',
            icon: 'Boxes',
            version: '1.0.0',
            commands: ['navigate.home', 'navigate.settings'],
            routes: [{ path: '/test', label: 'Test' }],
            topologies: [{ id: 'topo-1', file: 'topologies/main.ts' }],
            requiredFeatures: ['feature-a'],
            dependencies: ['other-domain'],
        });
        expect(errors).toEqual([]);
    });

    it('should reject null', () => {
        const errors = validateDomainManifest(null);
        expect(errors).toEqual(['Manifest must be a non-null object']);
    });

    it('should reject non-object', () => {
        const errors = validateDomainManifest('string');
        expect(errors).toEqual(['Manifest must be a non-null object']);
    });

    it('should require id', () => {
        const errors = validateDomainManifest({ name: 'Test' });
        expect(errors).toContain('Missing required field: id (string)');
    });

    it('should require name', () => {
        const errors = validateDomainManifest({ id: 'test' });
        expect(errors).toContain('Missing required field: name (string)');
    });

    it('should reject non-kebab-case id', () => {
        const errors = validateDomainManifest({ id: 'MyDomain', name: 'Test' });
        expect(errors.some((e) => e.includes('kebab-case'))).toBe(true);
    });

    it('should reject id starting with number', () => {
        const errors = validateDomainManifest({ id: '1domain', name: 'Test' });
        expect(errors.some((e) => e.includes('kebab-case'))).toBe(true);
    });

    it('should accept simple kebab-case ids', () => {
        const valid = ['a', 'my-domain', 'foo-bar-baz', 'domain123'];
        for (const id of valid) {
            const errors = validateDomainManifest({ id, name: 'Test' });
            expect(errors).toEqual([]);
        }
    });

    it('should reject commands that is not an array', () => {
        const errors = validateDomainManifest({
            id: 'test',
            name: 'Test',
            commands: 'not-array',
        });
        expect(errors).toContain('commands must be an array of strings');
    });

    it('should reject routes that is not an array', () => {
        const errors = validateDomainManifest({
            id: 'test',
            name: 'Test',
            routes: 'not-array',
        });
        expect(errors).toContain('routes must be an array');
    });

    it('should reject topologies that is not an array', () => {
        const errors = validateDomainManifest({
            id: 'test',
            name: 'Test',
            topologies: 'not-array',
        });
        expect(errors).toContain('topologies must be an array');
    });

    it('should report multiple errors at once', () => {
        const errors = validateDomainManifest({
            commands: 'bad',
            routes: 'bad',
        });
        expect(errors.length).toBeGreaterThanOrEqual(3); // id, name, commands
    });
});
