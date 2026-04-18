/**
 * Component: ExampleItemForm
 *
 * Create/Edit form for example items.
 * Uses shared Zod schemas for client-side validation.
 */

import React, { useState } from 'react';
import {
    CreateExampleItemSchema,
    type CreateExampleItem,
} from '@surdej/module-member-example-shared';
import { useModuleApi } from '../hooks/useModuleApi.js';

export interface ExampleItemFormProps {
    onCreated?: () => void;
}

export function ExampleItemForm({ onCreated }: ExampleItemFormProps) {
    const api = useModuleApi();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Client-side validation with the same Zod schema the worker uses
        const input: CreateExampleItem = { name, description: description || undefined };
        const parsed = CreateExampleItemSchema.safeParse(input);
        if (!parsed.success) {
            setError(parsed.error.errors.map((e) => e.message).join(', '));
            return;
        }

        setSubmitting(true);
        try {
            await api.create(parsed.data);
            setName('');
            setDescription('');
            onCreated?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form data-component="ExampleItemForm" onSubmit={handleSubmit}>
            <div>
                <label htmlFor="example-name">Name</label>
                <input
                    id="example-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="example-description">Description</label>
                <textarea
                    id="example-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>
            {error && <div style={{ color: 'red' }}>{error}</div>}
            <button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Item'}
            </button>
        </form>
    );
}
