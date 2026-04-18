import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
    Database, ArrowLeft, Table2, HardDrive, RefreshCw,
    ChevronRight, Rows3, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/core/i18n';

interface TableInfo {
    name: string;
    rowCount: number;
    totalBytes: number;
    totalSize: string;
    indexBytes: number;
    indexSize: string;
}

interface DatabaseStats {
    databaseSize: string;
    activeConnections: number;
    tables: TableInfo[];
}

export function DatabaseExplorerPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [stats, setStats] = useState<DatabaseStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'rows' | 'size'>('size');

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get<DatabaseStats>('/platform/database');
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch database stats:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const filteredTables = stats?.tables
        .filter(t => !filter || t.name.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => {
            switch (sortBy) {
                case 'name': return a.name.localeCompare(b.name);
                case 'rows': return b.rowCount - a.rowCount;
                case 'size': return b.totalBytes - a.totalBytes;
            }
        }) ?? [];

    const totalRows = stats?.tables.reduce((sum, t) => sum + t.rowCount, 0) ?? 0;
    const totalBytes = stats?.tables.reduce((sum, t) => sum + t.totalBytes, 0) ?? 0;

    // Color gradient based on relative table size
    function sizeColor(bytes: number): string {
        if (totalBytes === 0) return 'bg-muted';
        const ratio = bytes / totalBytes;
        if (ratio > 0.3) return 'bg-rose-500/20 text-rose-700 dark:text-rose-400';
        if (ratio > 0.1) return 'bg-amber-500/20 text-amber-700 dark:text-amber-400';
        if (ratio > 0.03) return 'bg-sky-500/20 text-sky-700 dark:text-sky-400';
        return 'bg-muted text-muted-foreground';
    }

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/platform')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 p-2.5 shadow-md">
                        <Database className="h-[22px] w-[22px] text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{t('database.title')}</h1>
                        <p className="text-xs text-muted-foreground">
                            {t('database.subtitle')}
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchStats}
                    disabled={loading}
                    className="gap-1.5"
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    {t('common.refresh')}
                </Button>
            </div>

            <Separator className="mb-6" />

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-cyan-500/5" />
                    <CardContent className="p-4 relative">
                        <HardDrive className="h-4 w-4 text-teal-500 mb-2" />
                        <div className="text-xl font-bold">{stats?.databaseSize ?? '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{t('database.dbSize')}</div>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5" />
                    <CardContent className="p-4 relative">
                        <Table2 className="h-4 w-4 text-violet-500 mb-2" />
                        <div className="text-xl font-bold">{stats?.tables.length ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground">{t('database.tables')}</div>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5" />
                    <CardContent className="p-4 relative">
                        <Rows3 className="h-4 w-4 text-amber-500 mb-2" />
                        <div className="text-xl font-bold">{totalRows.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">{t('database.totalRows')}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter + Sort */}
            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder={t('database.filterTables')}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="pl-9 h-8 text-xs"
                    />
                </div>
                <div className="flex items-center gap-1">
                    {(['size', 'rows', 'name'] as const).map((s) => (
                        <Button
                            key={s}
                            variant={sortBy === s ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 text-xs px-3"
                            onClick={() => setSortBy(s)}
                        >
                            {s === 'size' ? t('database.sortSize') : s === 'rows' ? t('database.sortRows') : t('database.sortName')}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Table list */}
            <div className="space-y-1.5">
                {filteredTables.map((table) => {
                    const sizePercent = totalBytes > 0 ? (table.totalBytes / totalBytes) * 100 : 0;
                    return (
                        <Card
                            key={table.name}
                            className="group hover:shadow-md transition-all cursor-pointer"
                            onClick={() => {
                                // Navigate to tenant table browser if it exists
                                navigate(`/settings/tenants`);
                            }}
                        >
                            <CardContent className="flex items-center gap-4 p-3">
                                {/* Size bar indicator */}
                                <div className="w-1.5 h-10 rounded-full bg-muted overflow-hidden flex flex-col-reverse">
                                    <div
                                        className="bg-gradient-to-t from-teal-500 to-cyan-400 rounded-full transition-all"
                                        style={{ height: `${Math.max(5, sizePercent)}%` }}
                                    />
                                </div>

                                {/* Table name */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-medium">{table.name}</span>
                                        {table.name.startsWith('_') && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0">{t('database.system')}</Badge>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {t('database.index', { size: table.indexSize })}
                                    </div>
                                </div>

                                {/* Row count */}
                                <div className="text-right shrink-0">
                                    <Badge
                                        variant="secondary"
                                        className={cn('text-xs font-mono tabular-nums', sizeColor(table.totalBytes))}
                                    >
                                        {table.rowCount.toLocaleString()} {t('database.sortRows').toLowerCase()}
                                    </Badge>
                                </div>

                                {/* Size */}
                                <div className="text-right shrink-0 w-20">
                                    <div className="text-xs font-medium">{table.totalSize}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {sizePercent.toFixed(1)}%
                                    </div>
                                </div>

                                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                            </CardContent>
                        </Card>
                    );
                })}

                {filteredTables.length === 0 && !loading && (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                        {filter ? t('database.noTablesFilter', { filter }) : t('database.noTablesData')}
                    </div>
                )}
            </div>

            {/* Connection info */}
            {stats && (
                <div className="mt-4 text-center text-[10px] text-muted-foreground/50">
                    {t('database.activeConnections', { count: stats.activeConnections })}
                </div>
            )}
        </div>
    );
}
