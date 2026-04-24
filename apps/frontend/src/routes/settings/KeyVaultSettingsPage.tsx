import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, KeyRound, Plus, Trash2, Loader2, RefreshCw,
    Eye, EyeOff, Link, Unlink, Shield, ChevronDown, ChevronRight,
    Copy, Check, AlertTriangle, Pencil,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/core/i18n';

// ─── Types ─────────────────────────────────────────────────────

interface SecretEntry {
    id: string;
    name: string;
    slug: string;
    category: string;
    maskedValue: string;
    description: string | null;
    provider: string | null;
    metadata: Record<string, unknown> | null;
    lastUsedAt: string | null;
    createdAt: string;
    updatedAt: string;
    mappings: MappingRef[];
}

interface MappingRef {
    id: string;
    endpoint: string;
    envVar: string;
    isActive: boolean;
}

interface MappingEntry {
    id: string;
    tenantId: string;
    endpoint: string;
    envVar: string;
    secretId: string;
    priority: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    secret: {
        id: string;
        name: string;
        slug: string;
        provider: string | null;
    };
}

// ─── Category config ───────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
    'api-key': { label: 'API Key', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    'token': { label: 'Token', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    'credential': { label: 'Credential', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    'certificate': { label: 'Certificate', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

// ─── Well-known endpoints ──────────────────────────────────────

const KNOWN_ENDPOINTS = [
    { value: 'core-openai', label: 'Core OpenAI (AI Studio)', envVars: ['OPENAI_API_KEY', 'OPENAI_ORG_ID'] },
    { value: 'azure-openai', label: 'Azure OpenAI', envVars: ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'] },
    { value: 'anthropic', label: 'Anthropic', envVars: ['ANTHROPIC_API_KEY'] },
    { value: 'searxng', label: 'SearXNG Search', envVars: ['SEARXNG_API_KEY'] },
] as const;

// ─── Component ─────────────────────────────────────────────────

export function KeyVaultSettingsPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [secrets, setSecrets] = useState<SecretEntry[]>([]);
    const [mappings, setMappings] = useState<MappingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'secrets' | 'mappings'>('secrets');

    // ── Add Secret form state ──
    const [showAddSecret, setShowAddSecret] = useState(false);
    const [newName, setNewName] = useState('');
    const [newSlug, setNewSlug] = useState('');
    const [newCategory, setNewCategory] = useState<string>('api-key');
    const [newValue, setNewValue] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newProvider, setNewProvider] = useState('');
    const [addingSecret, setAddingSecret] = useState(false);

    // ── Add Mapping form state ──
    const [showAddMapping, setShowAddMapping] = useState(false);
    const [mapEndpoint, setMapEndpoint] = useState('');
    const [mapEnvVar, setMapEnvVar] = useState('API_KEY');
    const [mapSecretId, setMapSecretId] = useState('');
    const [addingMapping, setAddingMapping] = useState(false);

    // ── Copy/feedback ──
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // ── Expand secret detail ──
    const [expandedSecret, setExpandedSecret] = useState<string | null>(null);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const [secretsRes, mappingsRes] = await Promise.allSettled([
                api.get<{ secrets: SecretEntry[]; total: number }>('/keyvault/secrets'),
                api.get<{ mappings: MappingEntry[]; total: number }>('/keyvault/mappings'),
            ]);

            if (secretsRes.status === 'fulfilled') setSecrets(secretsRes.value.secrets);
            if (mappingsRes.status === 'fulfilled') setMappings(mappingsRes.value.mappings);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Auto-generate slug from name ──
    const handleNameChange = (name: string) => {
        setNewName(name);
        setNewSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    };

    // ── Create secret ──
    const handleAddSecret = async () => {
        if (!newName.trim() || !newSlug.trim() || !newValue.trim()) return;
        setAddingSecret(true);
        try {
            await api.post('/keyvault/secrets', {
                name: newName.trim(),
                slug: newSlug.trim(),
                category: newCategory,
                value: newValue,
                description: newDescription.trim() || undefined,
                provider: newProvider.trim() || undefined,
            });
            setShowAddSecret(false);
            setNewName('');
            setNewSlug('');
            setNewValue('');
            setNewDescription('');
            setNewProvider('');
            setNewCategory('api-key');
            await fetchData(true);
        } catch (err) {
            console.error('Failed to create secret', err);
        } finally {
            setAddingSecret(false);
        }
    };

    // ── Delete secret ──
    const handleDeleteSecret = async (id: string) => {
        try {
            await api.delete(`/keyvault/secrets/${id}`);
            await fetchData(true);
        } catch (err) {
            console.error('Failed to delete secret', err);
        }
    };

    // ── Create mapping ──
    const handleAddMapping = async () => {
        if (!mapEndpoint.trim() || !mapSecretId) return;
        setAddingMapping(true);
        try {
            await api.post('/keyvault/mappings', {
                endpoint: mapEndpoint.trim(),
                envVar: mapEnvVar.trim() || 'API_KEY',
                secretId: mapSecretId,
            });
            setShowAddMapping(false);
            setMapEndpoint('');
            setMapEnvVar('API_KEY');
            setMapSecretId('');
            await fetchData(true);
        } catch (err) {
            console.error('Failed to create mapping', err);
        } finally {
            setAddingMapping(false);
        }
    };

    // ── Delete mapping ──
    const handleDeleteMapping = async (id: string) => {
        try {
            await api.delete(`/keyvault/mappings/${id}`);
            await fetchData(true);
        } catch (err) {
            console.error('Failed to delete mapping', err);
        }
    };

    // ── Toggle mapping active ──
    const handleToggleMapping = async (id: string, isActive: boolean) => {
        try {
            await api.patch(`/keyvault/mappings/${id}`, { isActive: !isActive });
            await fetchData(true);
        } catch (err) {
            console.error('Failed to toggle mapping', err);
        }
    };

    const handleCopySlug = (slug: string, id: string) => {
        navigator.clipboard.writeText(slug);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="mb-4 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Settings
                </Button>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 shadow-lg">
                            <KeyRound className="h-[22px] w-[22px] text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Key Vault</h1>
                            <p className="text-sm text-muted-foreground">Manage API keys and map them to module endpoints</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => fetchData(true)} disabled={refreshing}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit">
                <Button
                    variant={activeTab === 'secrets' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('secrets')}
                    className="gap-1.5"
                >
                    <Shield className="h-3.5 w-3.5" />
                    Secrets ({secrets.length})
                </Button>
                <Button
                    variant={activeTab === 'mappings' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('mappings')}
                    className="gap-1.5"
                >
                    <Link className="h-3.5 w-3.5" />
                    Mappings ({mappings.length})
                </Button>
            </div>

            {/* ═══════ Secrets Tab ═══════ */}
            {activeTab === 'secrets' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => setShowAddSecret(!showAddSecret)} className="gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            Add Secret
                        </Button>
                    </div>

                    {/* Add Secret Form */}
                    {showAddSecret && (
                        <Card className="border-primary/30 shadow-md">
                            <CardContent className="p-5 space-y-4">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                    <KeyRound className="h-4 w-4 text-primary" />
                                    New Secret
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="secret-name">Name</Label>
                                        <Input id="secret-name" placeholder="OpenAI Production Key" value={newName} onChange={e => handleNameChange(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label htmlFor="secret-slug">Slug</Label>
                                        <Input id="secret-slug" placeholder="openai-production-key" value={newSlug} onChange={e => setNewSlug(e.target.value)} className="font-mono text-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="secret-category">Category</Label>
                                        <select
                                            id="secret-category"
                                            value={newCategory}
                                            onChange={e => setNewCategory(e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                        >
                                            <option value="api-key">API Key</option>
                                            <option value="token">Token</option>
                                            <option value="credential">Credential</option>
                                            <option value="certificate">Certificate</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label htmlFor="secret-provider">Provider</Label>
                                        <Input id="secret-provider" placeholder="openai, azure, anthropic..." value={newProvider} onChange={e => setNewProvider(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="secret-value">Secret Value</Label>
                                    <Input id="secret-value" type="password" placeholder="sk-..." value={newValue} onChange={e => setNewValue(e.target.value)} className="font-mono" />
                                </div>
                                <div>
                                    <Label htmlFor="secret-desc">Description (optional)</Label>
                                    <Input id="secret-desc" placeholder="Production API key for..." value={newDescription} onChange={e => setNewDescription(e.target.value)} />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => setShowAddSecret(false)}>Cancel</Button>
                                    <Button size="sm" onClick={handleAddSecret} disabled={addingSecret || !newName.trim() || !newValue.trim()}>
                                        {addingSecret ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                                        Create Secret
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Secrets List */}
                    {secrets.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No secrets stored</p>
                                <p className="text-sm mt-1">Add API keys and credentials to the vault for secure storage.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {secrets.map(secret => {
                                const cat = CATEGORY_CONFIG[secret.category] ?? CATEGORY_CONFIG['api-key']!;
                                const isExpanded = expandedSecret === secret.id;

                                return (
                                    <Card key={secret.id} className="transition-all duration-200 hover:shadow-md">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setExpandedSecret(isExpanded ? null : secret.id)}
                                                    className="shrink-0"
                                                >
                                                    {isExpanded
                                                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm">{secret.name}</span>
                                                        <Badge variant="secondary" className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>
                                                        {secret.provider && (
                                                            <Badge variant="outline" className="text-[10px]">{secret.provider}</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <code className="text-xs text-muted-foreground font-mono">{secret.slug}</code>
                                                        <button
                                                            onClick={() => handleCopySlug(secret.slug, secret.id)}
                                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            {copiedId === secret.id
                                                                ? <Check className="h-3 w-3 text-green-500" />
                                                                : <Copy className="h-3 w-3" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <code className="text-xs text-muted-foreground font-mono shrink-0">{secret.maskedValue}</code>

                                                {secret.mappings.length > 0 && (
                                                    <Badge variant="secondary" className="gap-1 text-[10px]">
                                                        <Link className="h-2.5 w-2.5" />
                                                        {secret.mappings.length} mapping{secret.mappings.length !== 1 ? 's' : ''}
                                                    </Badge>
                                                )}

                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteSecret(secret.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>

                                            {/* Expanded detail */}
                                            {isExpanded && (
                                                <div className="mt-3 pt-3 border-t space-y-2 text-xs text-muted-foreground">
                                                    {secret.description && <p>{secret.description}</p>}
                                                    <div className="flex gap-4">
                                                        <span>Created: {new Date(secret.createdAt).toLocaleDateString()}</span>
                                                        {secret.lastUsedAt && <span>Last used: {new Date(secret.lastUsedAt).toLocaleString()}</span>}
                                                    </div>
                                                    {secret.mappings.length > 0 && (
                                                        <div>
                                                            <span className="font-medium text-foreground">Mapped to:</span>
                                                            <div className="flex gap-2 mt-1 flex-wrap">
                                                                {secret.mappings.map(m => (
                                                                    <Badge key={m.id} variant={m.isActive ? 'default' : 'outline'} className="text-[10px]">
                                                                        {m.endpoint} / {m.envVar}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════ Mappings Tab ═══════ */}
            {activeTab === 'mappings' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => setShowAddMapping(!showAddMapping)} className="gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            Add Mapping
                        </Button>
                    </div>

                    {/* Add Mapping Form */}
                    {showAddMapping && (
                        <Card className="border-primary/30 shadow-md">
                            <CardContent className="p-5 space-y-4">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                    <Link className="h-4 w-4 text-primary" />
                                    Map Endpoint to Secret
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="map-endpoint">Endpoint / Module</Label>
                                        <select
                                            id="map-endpoint"
                                            value={mapEndpoint}
                                            onChange={e => {
                                                setMapEndpoint(e.target.value);
                                                const known = KNOWN_ENDPOINTS.find(k => k.value === e.target.value);
                                                if (known?.envVars[0]) setMapEnvVar(known.envVars[0]);
                                            }}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                        >
                                            <option value="">Select endpoint...</option>
                                            {KNOWN_ENDPOINTS.map(ep => (
                                                <option key={ep.value} value={ep.value}>{ep.label}</option>
                                            ))}
                                            <option value="__custom">Custom...</option>
                                        </select>
                                        {mapEndpoint === '__custom' && (
                                            <Input className="mt-2" placeholder="my-custom-endpoint" onChange={e => setMapEndpoint(e.target.value)} />
                                        )}
                                    </div>
                                    <div>
                                        <Label htmlFor="map-envvar">Env Variable</Label>
                                        <Input
                                            id="map-envvar"
                                            placeholder="OPENAI_API_KEY"
                                            value={mapEnvVar}
                                            onChange={e => setMapEnvVar(e.target.value)}
                                            className="font-mono text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="map-secret">Secret</Label>
                                    <select
                                        id="map-secret"
                                        value={mapSecretId}
                                        onChange={e => setMapSecretId(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                    >
                                        <option value="">Select secret...</option>
                                        {secrets.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.slug})</option>
                                        ))}
                                    </select>
                                    {secrets.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            No secrets yet. Create one first on the Secrets tab.
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => setShowAddMapping(false)}>Cancel</Button>
                                    <Button size="sm" onClick={handleAddMapping} disabled={addingMapping || !mapEndpoint.trim() || !mapSecretId}>
                                        {addingMapping ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Link className="h-3.5 w-3.5 mr-1" />}
                                        Create Mapping
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Mappings List */}
                    {mappings.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <Unlink className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No endpoint mappings</p>
                                <p className="text-sm mt-1">Map module endpoints to secrets from the vault so workers can use them.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {mappings.map(mapping => (
                                <Card key={mapping.id} className={`transition-all duration-200 ${mapping.isActive ? '' : 'opacity-60'}`}>
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${mapping.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <code className="font-mono text-sm font-semibold">{mapping.endpoint}</code>
                                                <span className="text-muted-foreground text-xs">/</span>
                                                <code className="font-mono text-xs text-muted-foreground">{mapping.envVar}</code>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                                <KeyRound className="h-3 w-3" />
                                                {mapping.secret.name}
                                                {mapping.secret.provider && (
                                                    <Badge variant="outline" className="text-[10px] ml-1">{mapping.secret.provider}</Badge>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs gap-1"
                                            onClick={() => handleToggleMapping(mapping.id, mapping.isActive)}
                                        >
                                            {mapping.isActive ? (
                                                <><Eye className="h-3 w-3" /> Active</>
                                            ) : (
                                                <><EyeOff className="h-3 w-3" /> Inactive</>
                                            )}
                                        </Button>

                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteMapping(mapping.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
