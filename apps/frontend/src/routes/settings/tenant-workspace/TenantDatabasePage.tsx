/**
 * Tenant Database Page
 *
 * Database browser for the current tenant.
 * Shows schemas, tables with row counts & sizes, and links to table detail view.
 *
 * Route: /settings/tenants/:tenantId/database
 */

import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useParams } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Database, Table2, HardDrive, Clock, Layers, Server,
    ChevronRight, Loader2, RefreshCw, Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Tenant } from '@/core/tenants/TenantContext';

interface TableInfo {
    name: string;
    estimatedRows: number;
    sizeBytes: number;
    sizePretty: string;
    tenantScoped: boolean;
}

export function TenantDatabasePage() {
    const { tenantId } = useParams<{ tenantId: string }>();
    const navigate = useNavigate();
    const { tenant } = useOutletContext<{
        tenant: Tenant;
        setTenant: React.Dispatch<React.SetStateAction<Tenant | null>>;
    }>();

    const [schemas, setSchemas] = useState<string[]>([]);
    const [activeSchema, setActiveSchema] = useState<string>('public');
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('');

    // ── Load schemas ──
    useEffect(() => {
        (async () => {
            try {
                const s = await api.get<string[]>(`/database/schemas`);
                setSchemas(s);
                if (s.length > 0 && !s.includes(activeSchema)) {
                    setActiveSchema(s[0]);
                }
            } catch (err) {
                console.error('Failed to load schemas:', err);
            }
        })();
    }, []);

    // ── Load tables for active schema ──
    useEffect(() => {
        if (!activeSchema) return;
        setLoading(true);
        (async () => {
            try {
                const t = await api.get<TableInfo[]>(`/database/schemas/${activeSchema}/tables?tenantId=${tenant.id}`);
                setTables(t);
            } catch (err) {
                console.error('Failed to load tables:', err);
                setTables([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [activeSchema]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const t = await api.get<TableInfo[]>(`/database/schemas/${activeSchema}/tables?tenantId=${tenant.id}`);
            setTables(t);
        } catch { /* skip */ } finally {
            setRefreshing(false);
        }
    };

    if (!tenant) return null;

    const filteredTables = tables.filter((t) =>
        t.name.toLowerCase().includes(filter.toLowerCase()),
    );

    const totalRows = tables.reduce((sum, t) => sum + t.estimatedRows, 0);
    const totalSize = tables.reduce((sum, t) => sum + t.sizeBytes, 0);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Database</h2>
                    <Badge variant="secondary" className="text-[10px]">{tenant.slug}</Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatCard icon={Table2} label="Tables" value={String(tables.length)} color="text-blue-400" />
                <StatCard icon={Layers} label="Rows" value={totalRows.toLocaleString()} color="text-emerald-400" />
                <StatCard icon={HardDrive} label="Size" value={formatSize(totalSize)} color="text-amber-400" />
                <StatCard icon={Clock} label="Schemas" value={String(schemas.length)} color="text-purple-400" />
            </div>

            {/* Connection info */}
            <Card className="mb-6">
                <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Server className="h-4 w-4 text-primary" />
                        Connection Details
                    </div>

                    <div className="space-y-2">
                        <ConnectionRow label="Host" value="localhost" />
                        <ConnectionRow label="Port" value="5432" />
                        <ConnectionRow label="Database" value="surdej" />
                        <ConnectionRow label="Schema" value={activeSchema} />
                        <ConnectionRow label="Tenant ID" value={tenant.id} mono />
                    </div>
                </CardContent>
            </Card>

            {/* Schema selector + filter */}
            <div className="flex items-center gap-3 mb-4">
                {/* Schema tabs */}
                <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                    {schemas.map((s) => (
                        <button
                            key={s}
                            onClick={() => setActiveSchema(s)}
                            className={cn(
                                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                                s === activeSchema
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <div className="flex-1" />

                {/* Filter */}
                <div className="relative w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Filter tables…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="h-8 pl-8 text-xs"
                    />
                </div>
            </div>

            {/* Tables list */}
            <Card>
                <CardContent className="p-0">
                    <div className="flex items-center gap-2 text-sm font-semibold px-5 py-3 border-b">
                        <Table2 className="h-4 w-4 text-primary" />
                        Tables
                        <Badge variant="secondary" className="text-[10px] ml-1">
                            {filteredTables.length}
                        </Badge>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredTables.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Database className="h-10 w-10 mb-3 opacity-20" />
                            <p className="text-sm font-medium">
                                {filter ? 'No matching tables' : 'No tables found'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {/* Header row */}
                            <div className="grid grid-cols-[1fr_100px_100px_40px] gap-4 px-5 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-medium bg-muted/30">
                                <span>Table Name</span>
                                <span className="text-right">Rows</span>
                                <span className="text-right">Size</span>
                                <span />
                            </div>

                            {filteredTables.map((t) => (
                                <button
                                    key={t.name}
                                    onClick={() =>
                                        navigate(
                                            `/settings/tenants/${tenantId}/database/${activeSchema}/${t.name}`,
                                        )
                                    }
                                    className="grid grid-cols-[1fr_100px_100px_40px] gap-4 px-5 py-3 w-full text-left hover:bg-muted/40 transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <Table2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-sm font-medium truncate">
                                            {t.name}
                                        </span>
                                        {t.tenantScoped && (
                                            <Badge variant="default" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                                                scoped
                                            </Badge>
                                        )}
                                        {t.name.startsWith('_') && (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                                system
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground text-right tabular-nums self-center">
                                        {t.estimatedRows.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-muted-foreground text-right self-center">
                                        {t.sizePretty}
                                    </span>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center justify-self-end" />
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ── Helpers ──

function StatCard({ icon: Icon, label, value, color }: {
    icon: React.FC<{ className?: string }>;
    label: string;
    value: string;
    color: string;
}) {
    return (
        <Card className="bg-muted/20">
            <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-background border ${color}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
                    <div className="text-sm font-semibold">{value}</div>
                </div>
            </CardContent>
        </Card>
    );
}

function ConnectionRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between text-xs py-1 border-b border-dashed last:border-0">
            <span className="text-muted-foreground">{label}</span>
            <span className={mono ? 'font-mono text-[10px]' : ''}>{value}</span>
        </div>
    );
}
