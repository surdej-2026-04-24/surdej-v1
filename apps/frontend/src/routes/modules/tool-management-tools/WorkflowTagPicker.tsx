/**
 * WorkflowTagPicker — Toggle tags on/off for a given use case.
 */

import { useState, useEffect } from 'react';
import { Tags, Loader2 } from 'lucide-react';
import {
    fetchWorkflowTags, fetchUseCaseTags, setUseCaseTags,
    type WorkflowTagItem,
} from './use-case-api';

interface WorkflowTagPickerProps {
    useCaseId: string;
}

export function WorkflowTagPicker({ useCaseId }: WorkflowTagPickerProps) {
    const [allTags, setAllTags] = useState<WorkflowTagItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [tagsRes, currentRes] = await Promise.all([
                    fetchWorkflowTags(),
                    fetchUseCaseTags(useCaseId),
                ]);
                if (cancelled) return;
                setAllTags(tagsRes.items);
                setSelectedIds(new Set(currentRes.items.map((t) => t.id)));
            } catch {
                // silently fail — tags are optional
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [useCaseId]);

    const toggleTag = async (tagId: string) => {
        const next = new Set(selectedIds);
        if (next.has(tagId)) {
            next.delete(tagId);
        } else {
            next.add(tagId);
        }
        setSelectedIds(next);
        setSaving(true);
        try {
            await setUseCaseTags(useCaseId, Array.from(next));
        } catch {
            // revert on error
            setSelectedIds(selectedIds);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading tags…
            </div>
        );
    }

    if (allTags.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                No tags defined. Create tags in Admin → Workflow Tags.
            </p>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-1.5 mb-2">
                <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Tags</span>
                {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                    const selected = selectedIds.has(tag.id);
                    return (
                        <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            className={`
                                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                                border transition-all cursor-pointer
                                ${selected
                                    ? 'border-transparent text-white shadow-sm'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-background'
                                }
                            `}
                            style={selected ? { backgroundColor: tag.color } : undefined}
                        >
                            <span
                                className={`h-2 w-2 rounded-full shrink-0 ${selected ? 'bg-white/40' : ''}`}
                                style={!selected ? { backgroundColor: tag.color } : undefined}
                            />
                            {tag.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
