/**
 * Virtual Page Manager
 *
 * CRUD list for managing virtual pages within a skin.
 * Includes create form, delete confirmation, export per page, and import.
 * Embedded as a section within SkinEditorPage.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Trash2,
    ExternalLink,
    FileCode,
    Upload,
    Loader2,
    Copy,
} from 'lucide-react';
import type { VirtualPageListItem } from '@/types/virtual-page';
import {
    listVirtualPages,
    createVirtualPage,
    deleteVirtualPage,
} from '@/services/virtualPageApi';
import { ExportButton } from './ExportButton';
import { ImportDialog } from './ImportDialog';

const DEFAULT_TEMPLATE = `function Component() {
  return (
    <div style={{ padding: "24px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontWeight: 300 }}>New Page</h1>
      <p style={{ color: "#666" }}>Start building your page here.</p>
    </div>
  );
}`;

interface VirtualPageManagerProps {
    skinId: string;
    onEditPage?: (pageId: string) => void;
}

export function VirtualPageManager({ skinId, onEditPage }: VirtualPageManagerProps) {
    const [pages, setPages] = useState<VirtualPageListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Load pages ──

    const loadPages = useCallback(async () => {
        try {
            const data = await listVirtualPages(skinId);
            setPages(data);
            setError(null);
        } catch (err) {
            console.error('Failed to load virtual pages:', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(`Failed to load pages: ${message}`);
        } finally {
            setLoading(false);
        }
    }, [skinId]);

    useEffect(() => {
        loadPages();
    }, [loadPages]);

    // ── Create ──

    const handleCreate = useCallback(async () => {
        if (!newName.trim()) return;
        setCreating(true);
        setError(null);
        try {
            await createVirtualPage(skinId, {
                name: newName.trim(),
                source: DEFAULT_TEMPLATE.replace('New Page', newName.trim()),
            });
            setNewName('');
            setShowCreate(false);
            await loadPages();
        } catch (err) {
            console.error('Failed to create page:', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(`Page creation failed: ${message}`);
        } finally {
            setCreating(false);
        }
    }, [skinId, newName, loadPages]);

    // ── Delete ──

    const handleDelete = useCallback(
        async (pageId: string) => {
            setDeleting(pageId);
            try {
                await deleteVirtualPage(skinId, pageId);
                await loadPages();
            } catch (err) {
                console.error('Failed to delete page:', err);
            } finally {
                setDeleting(null);
            }
        },
        [skinId, loadPages],
    );

    // ── Copy link ──

    const handleCopyLink = useCallback((page: VirtualPageListItem) => {
        const url = `${window.location.origin}/vp/${page.skinId}/${page.slug}`;
        navigator.clipboard.writeText(url);
    }, []);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileCode className="size-5 text-purple-400" />
                    <h3 className="font-semibold">Virtual Pages</h3>
                    <Badge variant="secondary" className="text-xs">
                        {pages.length}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <ExportButton mode="skin" skinId={skinId} variant="ghost" size="sm" />
                    <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
                        <Upload className="size-4" />
                        <span className="ml-1.5">Import</span>
                    </Button>
                    <Button size="sm" onClick={() => setShowCreate(true)}>
                        <Plus className="size-4" />
                        <span className="ml-1.5">New Page</span>
                    </Button>
                </div>
            </div>

            {/* Create form */}
            {showCreate && (
                <Card>
                    <CardContent className="flex items-center gap-2 pt-4">
                        <Input
                            placeholder="Page name..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            autoFocus
                        />
                        <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
                            {creating ? <Loader2 className="size-4 animate-spin" /> : 'Create'}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setShowCreate(false);
                                setNewName('');
                                setError(null);
                            }}
                        >
                            Cancel
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Error message */}
            {error && (
                <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 text-destructive text-sm">
                    {error}
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            ) : pages.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <FileCode className="size-10 mb-3 opacity-30" />
                        <p className="text-sm">No virtual pages yet</p>
                        <p className="text-xs mt-1">Create one or import from YAML</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {pages.map((page) => (
                        <Card
                            key={page.id}
                            className="group hover:border-primary/30 transition-colors cursor-pointer"
                            onClick={() => onEditPage?.(page.id)}
                        >
                            <CardContent className="flex items-center gap-3 py-3 px-4">
                                <FileCode className="size-4 text-purple-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{page.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        /{page.slug}
                                    </p>
                                </div>
                                <div
                                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ExportButton
                                        mode="page"
                                        skinId={skinId}
                                        pageId={page.id}
                                        pageSlug={page.slug}
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        onClick={() => handleCopyLink(page)}
                                        title="Copy link"
                                    >
                                        <Copy className="size-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        asChild
                                    >
                                        <a
                                            href={`/vp/${page.skinId}/${page.slug}`}
                                            target="_blank"
                                            rel="noopener"
                                            title="Open in new tab"
                                        >
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-red-400 hover:text-red-300"
                                        disabled={deleting === page.id}
                                        onClick={() => handleDelete(page.id)}
                                        title="Delete"
                                    >
                                        {deleting === page.id ? (
                                            <Loader2 className="size-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="size-3.5" />
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Import dialog */}
            <ImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                skinId={skinId}
                onImported={loadPages}
            />
        </div>
    );
}
