/**
 * DynamicForm — Schema-driven form panel for workflow steps.
 *
 * Auto-generates form inputs from a JSON Schema `dataSchema`.
 * Shows field completion status (✓ filled, ⚠ required + empty).
 * Supports string, number, boolean, and textarea (multiline strings).
 */

import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface SchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
}

interface DataSchema {
    type: 'object';
    required?: string[];
    properties: Record<string, SchemaProperty>;
}

export function DynamicForm({
    schema,
    formData,
    onChange,
    onAdvance,
    onRevert,
    canRevert,
    isAdvancing,
    isLastStep,
}: {
    schema: DataSchema;
    formData: Record<string, any>;
    onChange: (key: string, val: string) => void;
    onAdvance: () => void;
    onRevert?: () => void;
    canRevert: boolean;
    isAdvancing?: boolean;
    isLastStep?: boolean;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const properties = schema?.properties || {};
    const required = schema?.required || [];
    const entries = Object.entries(properties);

    const filledCount = entries.filter(([key]) => {
        const val = formData[key];
        return val !== undefined && val !== null && val !== '';
    }).length;

    const requiredFilled = required.every((reqKey: string) => {
        const val = formData[reqKey];
        return val !== undefined && val !== null && val !== '';
    });

    if (entries.length === 0) {
        // No schema fields — just show advance button
        return (
            <div className="p-3 shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <div className="flex gap-2">
                    {canRevert && onRevert && (
                        <Button variant="outline" size="sm" onClick={onRevert} disabled={isAdvancing} className="flex-1">
                            ← Back
                        </Button>
                    )}
                    <Button size="sm" onClick={onAdvance} disabled={isAdvancing} className="flex-1">
                        {isAdvancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isLastStep ? 'Complete ✓' : 'Continue →'}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.06)]">
            {/* Collapsible header */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold hover:bg-muted/30 transition-colors"
            >
                <span className="flex items-center gap-2">
                    Data Fields
                    <span className="text-[10px] font-normal text-muted-foreground tabular-nums">
                        {filledCount}/{entries.length} filled
                    </span>
                    {requiredFilled && filledCount > 0 && (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                    )}
                </span>
                {collapsed ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>

            {!collapsed && (
                <div className="px-4 pb-3 space-y-3">
                    {entries.map(([key, prop]) => {
                        const isRequired = required.includes(key);
                        const value = formData[key];
                        const isFilled = value !== undefined && value !== null && value !== '';
                        const isLongText = prop.type === 'string' && ((prop as any).multiline || prop.description?.toLowerCase().includes('body') || prop.description?.toLowerCase().includes('text') || key.toLowerCase().includes('body') || key.toLowerCase().includes('content') || key.toLowerCase().includes('description'));

                        return (
                            <div key={key} className="space-y-1">
                                <label className="text-[11px] font-medium flex items-center gap-1.5">
                                    {isFilled ? (
                                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                    ) : isRequired ? (
                                        <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                                    ) : (
                                        <div className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />
                                    )}
                                    <span className="truncate">{formatFieldName(key)}</span>
                                    {!isRequired && (
                                        <span className="text-[9px] text-muted-foreground font-normal ml-auto">optional</span>
                                    )}
                                </label>
                                {isLongText ? (
                                    <textarea
                                        value={formData[key] || ''}
                                        onChange={(e) => onChange(key, e.target.value)}
                                        placeholder={prop.description || `Enter ${formatFieldName(key)}...`}
                                        rows={3}
                                        className="w-full text-sm rounded-md border border-input bg-zinc-50 dark:bg-zinc-900 px-3 py-2 resize-y focus:ring-1 focus:ring-primary outline-none transition-shadow"
                                    />
                                ) : prop.type === 'boolean' ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onChange(key, formData[key] === 'true' ? 'false' : 'true')}
                                            className={`
                                                relative w-8 h-[18px] rounded-full transition-colors
                                                ${formData[key] === 'true' ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}
                                            `}
                                        >
                                            <div
                                                className={`
                                                    absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform
                                                    ${formData[key] === 'true' ? 'translate-x-[18px]' : 'translate-x-0.5'}
                                                `}
                                            />
                                        </button>
                                        <span className="text-xs text-muted-foreground">
                                            {formData[key] === 'true' ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                ) : (
                                    <Input
                                        type={prop.type === 'number' ? 'number' : 'text'}
                                        value={formData[key] || ''}
                                        onChange={(e) => onChange(key, e.target.value)}
                                        placeholder={prop.description || `Enter ${formatFieldName(key)}...`}
                                        className="text-sm h-8 bg-zinc-50 dark:bg-zinc-900"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Action buttons — always visible */}
            <div className="flex gap-2 px-4 pb-3">
                {canRevert && onRevert && (
                    <Button variant="outline" size="sm" onClick={onRevert} disabled={isAdvancing} className="flex-1">
                        ← Back
                    </Button>
                )}
                <Button
                    size="sm"
                    disabled={!requiredFilled || isAdvancing}
                    onClick={onAdvance}
                    className="flex-1"
                >
                    {isAdvancing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isLastStep ? (
                        'Complete ✓'
                    ) : (
                        'Continue →'
                    )}
                </Button>
            </div>
        </div>
    );
}

/** Convert camelCase/snake_case field names to readable labels */
function formatFieldName(key: string): string {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^\w/, (c) => c.toUpperCase())
        .trim();
}
