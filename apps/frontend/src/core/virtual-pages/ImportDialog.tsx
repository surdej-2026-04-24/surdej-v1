/**
 * Import Dialog
 *
 * Handles YAML import for both skins and virtual pages.
 * Shows conflict detection results and lets the user choose
 * overwrite / create new / skip per entity.
 */

import { useState, useCallback, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileCode, Palette, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ImportResolution, ImportDryRunResult } from '@/types/virtual-page';
import {
    parseYamlImport,
    dryRunPageImport,
    importPages,
    dryRunSkinImport,
    importSkin,
} from '@/services/virtualPageApi';

interface ImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Skin ID — when set, imports pages into this skin */
    skinId?: string;
    /** Called after successful import */
    onImported: () => void;
}

interface ConflictItem {
    slug: string;
    name: string;
    resolution: ImportResolution;
}

export function ImportDialog({ open, onOpenChange, skinId, onImported }: ImportDialogProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<'upload' | 'review' | 'importing' | 'done'>('upload');
    const [yamlContent, setYamlContent] = useState('');
    const [fileName, setFileName] = useState('');
    const [kind, setKind] = useState<'Skin' | 'VirtualPage' | 'unknown'>('unknown');
    const [dryRun, setDryRun] = useState<ImportDryRunResult | null>(null);
    const [skinResolution, setSkinResolution] = useState<ImportResolution>('new');
    const [pageConflicts, setPageConflicts] = useState<ConflictItem[]>([]);
    const [result, setResult] = useState<{ imported: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setStep('upload');
        setYamlContent('');
        setFileName('');
        setKind('unknown');
        setDryRun(null);
        setSkinResolution('new');
        setPageConflicts([]);
        setResult(null);
        setError(null);
    }, []);

    const handleOpenChange = useCallback(
        (v: boolean) => {
            if (!v) reset();
            onOpenChange(v);
        },
        [onOpenChange, reset],
    );

    // ── File Upload ──

    const handleFile = useCallback(
        async (file: File) => {
            setError(null);
            const text = await file.text();
            setFileName(file.name);
            setYamlContent(text);

            try {
                const { kind: k } = parseYamlImport(text);
                setKind(k);

                if (k === 'unknown') {
                    setError('Invalid YAML: missing "kind" field (expected "Skin" or "VirtualPage")');
                    return;
                }

                // Run dry-run
                let dr: ImportDryRunResult;
                if (k === 'VirtualPage' && skinId) {
                    dr = await dryRunPageImport(skinId, text);
                } else if (k === 'Skin') {
                    dr = await dryRunSkinImport(text);
                } else if (k === 'VirtualPage' && !skinId) {
                    setError('Cannot import a virtual page without a target skin. Use skin-level import.');
                    return;
                } else {
                    setError('Unexpected import kind');
                    return;
                }

                setDryRun(dr);

                // Build conflict list for pages
                const conflicts: ConflictItem[] = [];
                if (dr.conflicts) {
                    for (const c of dr.conflicts) {
                        conflicts.push({ slug: c.slug, name: c.name, resolution: 'overwrite' });
                    }
                }
                if (dr.pageConflicts) {
                    for (const c of dr.pageConflicts) {
                        if (!conflicts.some((x) => x.slug === c.slug)) {
                            conflicts.push({ slug: c.slug, name: c.name, resolution: 'overwrite' });
                        }
                    }
                }
                setPageConflicts(conflicts);

                // If skin has a conflict, default to "new"
                if (dr.skinConflict) {
                    setSkinResolution('new');
                }

                setStep('review');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to parse YAML');
            }
        },
        [skinId],
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
        },
        [handleFile],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        },
        [handleFile],
    );

    // ── Import ──

    const handleImport = useCallback(async () => {
        setStep('importing');
        setError(null);

        try {
            if (kind === 'VirtualPage' && skinId) {
                const resolutions: Record<string, ImportResolution> = {};
                for (const c of pageConflicts) {
                    resolutions[c.slug] = c.resolution;
                }
                const r = await importPages(skinId, yamlContent, resolutions);
                setResult({ imported: r.imported });
            } else if (kind === 'Skin') {
                const pageRes: Record<string, ImportResolution> = {};
                for (const c of pageConflicts) {
                    pageRes[c.slug] = c.resolution;
                }
                const r = await importSkin(yamlContent, skinResolution, pageRes);
                setResult({ imported: r.pages.filter((p) => p.action !== 'skipped').length });
            }
            setStep('done');
            onImported();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
            setStep('review');
        }
    }, [kind, skinId, yamlContent, pageConflicts, skinResolution, onImported]);

    // ── Conflict resolution toggle ──

    const setPageResolution = useCallback((slug: string, resolution: ImportResolution) => {
        setPageConflicts((prev) => prev.map((c) => (c.slug === slug ? { ...c, resolution } : c)));
    }, []);

    const hasConflicts = (dryRun?.skinConflict || pageConflicts.length > 0);
    const totalPages = dryRun?.total ?? dryRun?.totalPages ?? 0;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="size-5" />
                        Import {skinId ? 'Virtual Pages' : 'Skin'} (YAML)
                    </DialogTitle>
                </DialogHeader>

                {/* Error */}
                {error && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* Step: Upload */}
                {step === 'upload' && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 hover:border-muted-foreground/50 transition-colors cursor-pointer"
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <Upload className="size-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            Drop a <code className="text-xs">.yaml</code> file here or click to browse
                        </p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".yaml,.yml"
                            className="hidden"
                            onChange={handleFileInput}
                        />
                    </div>
                )}

                {/* Step: Review */}
                {step === 'review' && dryRun && (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        <p className="text-sm text-muted-foreground">
                            File: <code className="text-xs">{fileName}</code>
                        </p>

                        {/* Skin conflict */}
                        {kind === 'Skin' && dryRun.skinConflict && (
                            <div className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Palette className="size-4 text-blue-400" />
                                    <span className="text-sm font-medium">Skin: "{dryRun.skinConflict.name}"</span>
                                    <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                                        <AlertTriangle className="size-3 mr-1" /> Exists
                                    </Badge>
                                </div>
                                <div className="flex gap-1">
                                    {(['overwrite', 'new', 'skip'] as ImportResolution[]).map((r) => (
                                        <Button
                                            key={r}
                                            size="sm"
                                            variant={skinResolution === r ? 'default' : 'outline'}
                                            onClick={() => setSkinResolution(r)}
                                            className="text-xs h-7"
                                        >
                                            {r === 'overwrite' ? 'Overwrite' : r === 'new' ? 'Create New' : 'Skip'}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* No skin conflict */}
                        {kind === 'Skin' && !dryRun.skinConflict && (
                            <div className="rounded-lg border p-3 flex items-center gap-2">
                                <Palette className="size-4 text-blue-400" />
                                <span className="text-sm">Skin will be created</span>
                                <CheckCircle2 className="size-4 text-green-400 ml-auto" />
                            </div>
                        )}

                        {/* Page conflicts */}
                        {pageConflicts.map((c) => (
                            <div key={c.slug} className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <FileCode className="size-4 text-purple-400" />
                                    <span className="text-sm font-medium">"{c.name}"</span>
                                    <code className="text-xs text-muted-foreground">{c.slug}</code>
                                    <Badge variant="outline" className="text-amber-400 border-amber-400/30 ml-auto">
                                        <AlertTriangle className="size-3 mr-1" /> Exists
                                    </Badge>
                                </div>
                                <div className="flex gap-1">
                                    {(['overwrite', 'new', 'skip'] as ImportResolution[]).map((r) => (
                                        <Button
                                            key={r}
                                            size="sm"
                                            variant={c.resolution === r ? 'default' : 'outline'}
                                            onClick={() => setPageResolution(c.slug, r)}
                                            className="text-xs h-7"
                                        >
                                            {r === 'overwrite' ? 'Overwrite' : r === 'new' ? 'New Slug' : 'Skip'}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Non-conflicting pages */}
                        {!hasConflicts && totalPages > 0 && (
                            <div className="rounded-lg border p-3 flex items-center gap-2">
                                <FileCode className="size-4 text-purple-400" />
                                <span className="text-sm">{totalPages} page(s) — no conflicts</span>
                                <CheckCircle2 className="size-4 text-green-400 ml-auto" />
                            </div>
                        )}
                    </div>
                )}

                {/* Step: Importing */}
                {step === 'importing' && (
                    <div className="flex flex-col items-center gap-3 p-8">
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Importing...</p>
                    </div>
                )}

                {/* Step: Done */}
                {step === 'done' && result && (
                    <div className="flex flex-col items-center gap-3 p-8">
                        <CheckCircle2 className="size-8 text-green-400" />
                        <p className="text-sm">
                            Successfully imported <strong>{result.imported}</strong> item(s)
                        </p>
                    </div>
                )}

                {/* Footer */}
                <DialogFooter>
                    {step === 'review' && (
                        <>
                            <Button variant="outline" onClick={() => handleOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleImport}>Import</Button>
                        </>
                    )}
                    {step === 'done' && (
                        <Button onClick={() => handleOpenChange(false)}>Done</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
