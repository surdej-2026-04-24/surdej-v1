/**
 * Component: ExampleItemList
 *
 * Displays a list of example items fetched from the module API.
 */

import React, { useEffect, useState } from 'react';
import type { ExampleItem } from '@surdej/module-member-example-shared';
import { useModuleApi } from '../hooks/useModuleApi.js';

export interface ExampleItemListProps {
    onSelect?: (item: ExampleItem) => void;
}

export function ExampleItemList({ onSelect }: ExampleItemListProps) {
    const api = useModuleApi();
    const [items, setItems] = useState<ExampleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.list()
            .then((res) => setItems(res.items))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div data-component="ExampleItemList">Loading...</div>;
    if (error) return <div data-component="ExampleItemList">Error: {error}</div>;
    if (items.length === 0) return <div data-component="ExampleItemList">No items found.</div>;

    return (
        <div data-component="ExampleItemList">
            <ul>
                {items.map((item) => (
                    <li
                        key={item.id}
                        onClick={() => onSelect?.(item)}
                        style={{ cursor: onSelect ? 'pointer' : 'default' }}
                    >
                        <strong>{item.name}</strong>
                        {item.description && <span> — {item.description}</span>}
                        <span> [{item.status}]</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
