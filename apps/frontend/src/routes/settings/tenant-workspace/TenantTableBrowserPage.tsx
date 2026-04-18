/**
 * Tenant Table Browser Page
 *
 * Shows column metadata and paginated rows for a specific database table.
 *
 * Route: /settings/tenants/:tenantId/database/:schema/:table
 */

import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table2, ArrowLeft, Loader2, ChevronLeft, ChevronRight,
    ArrowUpDown, ArrowUp, ArrowDown, Key, Hash, Type, Calendar,
    ToggleLeft, Copy, Check, Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Tenant } from '@/core/tenants/TenantContext';

interface ColumnInfo {
    name: string;
    type: string;
    dataType: string;
    nullable: boolean;
    default: string | null;
    maxLength: number | null;
    isPrimaryKey: boolean;
}

interface TableData {
    schema: string;
    table: string;
    columns: ColumnInfo[];
    primaryKeys: string[];
    totalRows: number;
    limit: number;
    offset: number;
    rows: Record<string, unknown>[];
    tenantScoped: boolean;
    tenantFiltered: boolean;
}

const PAGE_SIZE = 50;

export function TenantTableBrowserPage() {
    const { tenantId, schema, table } = useParams<{
        tenantId: string;
        schema: string;
        table: string;
    }>();
    const navigate = useNavigate();
    const { tenant } = useOutletContext<{
        tenant: Tenant;
        setTenant: React.Dispatch<React.SetStateAction<Tenant | null>>;
    }>();

    const [data, setData] = useState<TableData | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [sortCol, setSortCol] = useState<string | undefined>();
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [copiedCell, setCopiedCell] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!schema || !table) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                limit: String(PAGE_SIZE),
                offset: String(page * PAGE_SIZE),
            });
            if (sortCol) {
                params.set('sort', sortCol);
                params.set('dir', sortDir);
            }
            if (tenant?.id) {
                params.set('tenantId', tenant.id);
            }
            const d = await api.get<TableData>(
                `/database/schemas/${schema}/tables/${table}?${params.toString()}`,
            );
            setData(d);
        } catch (err) {
            console.error('Failed to load table:', err);
        } finally {
            setLoading(false);
        }
    }, [schema, table, page, sortCol, sortDir]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSort = (col: string) => {
        if (sortCol === col) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortCol(col);
            setSortDir('asc');
        }
        setPage(0);
    };

    const copyToClipboard = async (value: string, key: string) => {
        await navigator.clipboard.writeText(value);
        setCopiedCell(key);
        setTimeout(() => setCopiedCell(null), 1500);
    };

    if (!tenant) return null;

    const totalPages = data ? Math.ceil(data.totalRows / PAGE_SIZE) : 0;

    const typeIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('int') || t.includes('float') || t.includes('numeric') || t.includes('decimal'))
            return <Hash className="h-3 w-3" />;
        if (t.includes('bool')) return <ToggleLeft className="h-3 w-3" />;
        if (t.includes('timestamp') || t.includes('date') || t.includes('time'))
            return <Calendar className="h-3 w-3" />;
        return <Type className="h-3 w-3" />;
    };

    const formatCellValue = (value: unknown): string => {
        if (value === null || value === undefined) return '∅';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    const getCellStyle = (value: unknown): string => {
        if (value === null || value === undefined) return 'text-muted-foreground/50 italic';
        if (typeof value === 'number') return 'tabular-nums text-right';
        if (typeof value === 'boolean') return '';
        return '';
    };

    return (
        <div className="max-w-[90vw] mx-auto animate-fade-in">
            {/* Navigation */}
            <div className="flex items-center gap-3 mb-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => navigate(`/settings/tenants/${tenantId}/database`)}
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Tables
                </Button>
                <div className="flex items-center gap-1.5 text-sm">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{schema}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-semibold">{table}</span>
                </div>
                {data && (
                    <Badge variant="secondary" className="text-[10px] ml-1">
                        {data.totalRows.toLocaleString()} rows
                    </Badge>
                )}
                {data?.tenantFiltered && (
                    <Badge variant="default" className="text-[10px] ml-1 bg-primary/10 text-primary border-0">
                        tenant-filtered
                    </Badge>
                )}
            </div>

            {/* Column metadata */}
            {data && (
                <Card className="mb-4">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                            <Table2 className="h-4 w-4 text-primary" />
                            Columns
                            <Badge variant="secondary" className="text-[10px]">
                                {data.columns.length}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {data.columns.map((col) => (
                                <div
                                    key={col.name}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all',
                                        col.isPrimaryKey
                                            ? 'bg-primary/5 border-primary/20 text-foreground'
                                            : 'bg-muted/30 border-border/50 text-muted-foreground',
                                    )}
                                >
                                    {col.isPrimaryKey && <Key className="h-3 w-3 text-primary" />}
                                    {typeIcon(col.type)}
                                    <span className="font-medium">{col.name}</span>
                                    <span className="text-[10px] opacity-60">{col.type}</span>
                                    {col.nullable && (
                                        <span className="text-[9px] opacity-40">nullable</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Data table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : !data || data.rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <Table2 className="h-10 w-10 mb-3 opacity-20" />
                            <p className="text-sm font-medium">No rows</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="px-3 py-2.5 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-medium w-10">
                                            #
                                        </th>
                                        {data.columns.map((col) => (
                                            <th
                                                key={col.name}
                                                className="px-3 py-2.5 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-medium cursor-pointer hover:text-foreground transition-colors select-none"
                                                onClick={() => handleSort(col.name)}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {col.isPrimaryKey && (
                                                        <Key className="h-2.5 w-2.5 text-primary" />
                                                    )}
                                                    <span className="truncate max-w-[120px]">
                                                        {col.name}
                                                    </span>
                                                    {sortCol === col.name ? (
                                                        sortDir === 'asc' ? (
                                                            <ArrowUp className="h-3 w-3 text-primary shrink-0" />
                                                        ) : (
                                                            <ArrowDown className="h-3 w-3 text-primary shrink-0" />
                                                        )
                                                    ) : (
                                                        <ArrowUpDown className="h-3 w-3 opacity-30 shrink-0" />
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.rows.map((row, rowIdx) => (
                                        <tr
                                            key={rowIdx}
                                            className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                                        >
                                            <td className="px-3 py-2 text-muted-foreground/50 tabular-nums">
                                                {data.offset + rowIdx + 1}
                                            </td>
                                            {data.columns.map((col) => {
                                                const value = row[col.name];
                                                const cellKey = `${rowIdx}-${col.name}`;
                                                const displayValue = formatCellValue(value);
                                                const truncated = displayValue.length > 60;

                                                return (
                                                    <td
                                                        key={col.name}
                                                        className={cn(
                                                            'px-3 py-2 max-w-[250px] group/cell relative',
                                                            getCellStyle(value),
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <span className="truncate">
                                                                {truncated
                                                                    ? displayValue.slice(0, 57) + '…'
                                                                    : displayValue}
                                                            </span>
                                                            {value !== null && value !== undefined && (
                                                                <button
                                                                    onClick={() =>
                                                                        copyToClipboard(
                                                                            displayValue,
                                                                            cellKey,
                                                                        )
                                                                    }
                                                                    className="opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0"
                                                                >
                                                                    {copiedCell === cellKey ? (
                                                                        <Check className="h-3 w-3 text-emerald-400" />
                                                                    ) : (
                                                                        <Copy className="h-3 w-3 text-muted-foreground" />
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {data && data.totalRows > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/10">
                            <span className="text-[10px] text-muted-foreground">
                                Showing {data.offset + 1}–
                                {Math.min(data.offset + data.rows.length, data.totalRows)} of{' '}
                                {data.totalRows.toLocaleString()} rows
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={page === 0}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <span className="text-xs text-muted-foreground px-2 tabular-nums">
                                    {page + 1} / {totalPages}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={page >= totalPages - 1}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
