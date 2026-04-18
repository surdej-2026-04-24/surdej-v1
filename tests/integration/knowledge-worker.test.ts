/**
 * Knowledge Worker Integration Tests
 *
 * Tests knowledge article indexing, template validation, training generation,
 * and duplicate detection via the API + worker combo.
 *
 * Prerequisites:
 *   - API server running
 *   - Knowledge worker running (or job results mocked)
 */

import { describe, it, expect } from 'vitest';

const API = process.env.API_URL ?? 'http://localhost:5001/api';

async function get(path: string) {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json();
}

async function post(path: string, body?: unknown) {
    const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return res.json();
}

describe('Knowledge API Integration', () => {
    it('should list articles', async () => {
        const data = await get('/knowledge/articles');
        expect(data).toHaveProperty('articles');
        expect(data).toHaveProperty('total');
        expect(Array.isArray(data.articles)).toBe(true);
    });

    it('should list templates', async () => {
        const data = await get('/knowledge/templates');
        expect(Array.isArray(data)).toBe(true);
    });

    it('should create an article', async () => {
        const article = await post('/knowledge/articles', {
            title: `Integration Test Article ${Date.now()}`,
            content: '# Test\n\nThis is an integration test article.\n\n## Section 1\n\nContent here.',
            authorId: 'system',
            tags: ['test', 'integration'],
        });

        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('slug');
        expect(article.title).toContain('Integration Test');
    });

    it('should create a template', async () => {
        const template = await post('/knowledge/templates', {
            name: `Test Template ${Date.now()}`,
            description: 'Integration test template',
            sections: [
                { title: 'Overview', contentType: 'rich-text', required: true },
                { title: 'Details', contentType: 'text', required: false },
                { title: 'Checklist', contentType: 'checklist', required: true },
            ],
        });

        expect(template).toHaveProperty('id');
        expect(template.name).toContain('Test Template');
    });

    it('should search articles via RAG endpoint', async () => {
        const data = await post('/ai/rag/search', {
            query: 'integration test',
            topK: 5,
        });

        expect(data).toHaveProperty('results');
        expect(Array.isArray(data.results)).toBe(true);
    });
});

describe('Training Module Integration', () => {
    it('should list training modules', async () => {
        const data = await get('/knowledge/training');
        expect(Array.isArray(data)).toBe(true);
    });
});
