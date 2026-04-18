/**
 * Extension Download &amp; Install Guide
 *
 * Route: /extension/download
 *
 * Provides:
 * 1. Version listing with download links
 * 2. Step-by-step installation guide for Chrome/Edge
 * 3. How to pin the extension
 * 4. Options page overview
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Download,
    Chrome,
    Globe2,
    Package,
    CheckCircle2,
    ArrowRight,
    Pin,
    Settings,
    Shield,
    AlertTriangle,
    Puzzle,
    Grip,
    Eye,
    ToggleLeft,
    CalendarDays,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/core/i18n';

// ─── Types ──────────────────────────────────────────────────────

interface ExtensionVersion {
    version: string;
    date: string;
    filename: string;
    notes: string;
}

interface VersionsManifest {
    latest: string;
    versions: ExtensionVersion[];
}

// ─── Helpers ────────────────────────────────────────────────────

function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const va = pa[i] ?? 0;
        const vb = pb[i] ?? 0;
        if (va > vb) return 1;
        if (va < vb) return -1;
    }
    return 0;
}

// ─── Step Component ─────────────────────────────────────────────

function InstallStep({
    step,
    title,
    children,
    color = 'from-blue-500 to-indigo-600',
}: {
    step: number;
    title: string;
    children: React.ReactNode;
    color?: string;
}) {
    return (
        <div className="flex gap-4 group">
            <div className="flex flex-col items-center">
                <div
                    className={cn(
                        'w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0',
                        'group-hover:scale-110 transition-transform duration-200',
                        color,
                    )}
                >
                    {step}
                </div>
                <div className="w-px flex-1 bg-border/50 mt-2" />
            </div>
            <div className="pb-8 flex-1">
                <h3 className="font-semibold text-base mb-2 mt-1">{title}</h3>
                <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    {children}
                </div>
            </div>
        </div>
    );
}

// ─── Feature Card ───────────────────────────────────────────────

function FeatureCard({
    icon: Icon,
    title,
    description,
}: {
    icon: React.FC<{ className?: string }>;
    title: string;
    description: string;
}) {
    return (
        <div className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
            <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────

export function ExtensionDownloadPage() {
    const { t } = useTranslation();
    const [manifest, setManifest] = useState<VersionsManifest | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAllVersions, setShowAllVersions] = useState(false);
    const [installedVersion, setInstalledVersion] = useState<string | null>(null);

    useEffect(() => {
        fetch('/extensions/versions.json')
            .then((r) => r.json())
            .then((data: VersionsManifest) => setManifest(data))
            .catch(() => setManifest(null))
            .finally(() => setLoading(false));

        // Try to detect installed extension version
        try {
            const el = document.getElementById('surdej-extension-version');
            if (el?.dataset.version) {
                setInstalledVersion(el.dataset.version);
            }
        } catch { /* ignore */ }
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-pulse text-muted-foreground">Loading extension info…</div>
            </div>
        );
    }

    const latest = manifest?.versions[0] ?? null;
    const isOutdated = installedVersion && latest
        ? compareVersions(installedVersion, latest.version) < 0
        : false;
    const visibleVersions = showAllVersions
        ? (manifest?.versions ?? [])
        : (manifest?.versions ?? []).slice(0, 3);

    return (
        <div className="max-w-3xl mx-auto animate-fade-in pb-16">
            {/* ─── Hero ─────────────────────────────────────────── */}
            <div className="mb-10 text-center">
                <div className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-4 mb-5 ring-1 ring-primary/10">
                    <Puzzle className="h-9 w-9 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">{t('extensionDownload.title')}</h1>
                <p className="text-base text-muted-foreground max-w-lg mx-auto">
                    {t('extensionDownload.subtitle')}
                </p>
                {latest && (
                    <div className="mt-4 flex items-center justify-center gap-3">
                        <a
                            href={`/extensions/${latest.filename}`}
                            download
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-lg hover:shadow-xl hover:brightness-110 transition-all duration-200"
                        >
                            <Download className="h-4 w-4" />
                            {t('extensionDownload.download', { version: latest.version })}
                        </a>
                    </div>
                )}
            </div>

            {/* ─── Update Warning ────────────────────────────────── */}
            {isOutdated && latest && (
                <div className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="font-semibold text-sm">{t('extensionDownload.updateAvailable')}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            You have version <strong>{installedVersion}</strong> installed.
                            Version <strong>{latest.version}</strong> is available with new features and fixes.
                        </p>
                        <a
                            href={`/extensions/${latest.filename}`}
                            download
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium mt-2"
                        >
                            <Download className="h-3 w-3" />
                            Download v{latest.version}
                        </a>
                    </div>
                </div>
            )}

            {installedVersion && !isOutdated && (
                <div className="mb-8 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                        <div className="font-semibold text-sm">{t('extensionDownload.upToDate')}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            You're running version <strong>{installedVersion}</strong> — the latest version.
                        </p>
                    </div>
                </div>
            )}

            <Separator className="mb-8" />

            {/* ─── Installation Guide ───────────────────────────── */}
            <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Chrome className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{t('extensionDownload.installGuide')}</h2>
                    <Badge variant="outline" className="ml-auto text-[10px]">Chrome &amp; Edge</Badge>
                </div>

                <Card className="overflow-hidden">
                    <CardContent className="p-6">
                        <InstallStep step={1} title="Download the Extension" color="from-blue-500 to-indigo-600">
                            <p>
                                Click the <strong>Download</strong> button above to save the
                                <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">.zip</code>
                                file to your computer. Don't extract the zip file yet.
                            </p>
                        </InstallStep>

                        <InstallStep step={2} title="Open Extension Settings" color="from-violet-500 to-purple-600">
                            <p>Open your browser's extension management page:</p>
                            <div className="mt-2 space-y-1.5">
                                <div className="flex items-center gap-2 text-xs">
                                    <Chrome className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span><strong>Chrome:</strong> Navigate to</span>
                                    <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">chrome://extensions</code>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span><strong>Edge:</strong> Navigate to</span>
                                    <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">edge://extensions</code>
                                </div>
                            </div>
                            <p className="mt-2 text-xs">
                                You can also click <strong>⋮ → Extensions → Manage Extensions</strong> from the browser menu.
                            </p>
                        </InstallStep>

                        <InstallStep step={3} title="Enable Developer Mode" color="from-fuchsia-500 to-pink-600">
                            <p>
                                Look for the <strong>Developer mode</strong> toggle in the top-right corner of the
                                extensions page and make sure it is <strong>turned on</strong>.
                            </p>
                            <div className="mt-2 flex items-center gap-2 p-2 rounded-md bg-muted/50 border text-xs">
                                <ToggleLeft className="h-4 w-4 text-primary" />
                                <span>Developer mode toggle must be <strong className="text-emerald-600">ON</strong></span>
                            </div>
                        </InstallStep>

                        <InstallStep step={4} title="Install the Extension" color="from-amber-500 to-orange-600">
                            <p>There are two ways to install:</p>
                            <div className="mt-2 space-y-3">
                                <div className="p-3 rounded-lg border bg-muted/20">
                                    <div className="font-medium text-xs text-foreground mb-1">Option A: Drag &amp; Drop (Easiest)</div>
                                    <p className="text-xs">
                                        Simply <strong>drag the downloaded .zip file</strong> and <strong>drop it directly</strong> onto
                                        the extensions page. The browser will automatically extract and install it.
                                    </p>
                                </div>
                                <div className="p-3 rounded-lg border bg-muted/20">
                                    <div className="font-medium text-xs text-foreground mb-1">Option B: Load Unpacked</div>
                                    <ol className="text-xs space-y-1 list-decimal list-inside">
                                        <li>Extract the downloaded .zip file to a folder</li>
                                        <li>Click the <strong>"Load unpacked"</strong> button on the extensions page</li>
                                        <li>Navigate to and select the extracted folder</li>
                                    </ol>
                                </div>
                            </div>
                        </InstallStep>

                        <InstallStep step={5} title="Verify Installation" color="from-emerald-500 to-teal-600">
                            <p>
                                After installation, you should see <strong>"Surdej"</strong> appear in your list of extensions
                                with a version number. The extension is now ready to use!
                            </p>
                            <div className="mt-2 flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Surdej extension installed successfully</span>
                            </div>
                        </InstallStep>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Pin the Extension ────────────────────────────── */}
            <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <Pin className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{t('extensionDownload.pinTitle')}</h2>
                </div>

                <Card>
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                            By default, new extensions are hidden behind the puzzle icon (<Puzzle className="h-3.5 w-3.5 inline-block mx-0.5" />)
                            in your browser toolbar. Pin the extension to keep it always visible:
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-xs font-bold text-primary">1</span>
                                </div>
                                <div className="text-sm">
                                    Click the <strong>puzzle piece icon</strong> (<Puzzle className="h-3.5 w-3.5 inline-block mx-0.5" />)
                                    in the top-right corner of your browser toolbar.
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-xs font-bold text-primary">2</span>
                                </div>
                                <div className="text-sm">
                                    Find <strong>"Surdej"</strong> in the list of extensions.
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-xs font-bold text-primary">3</span>
                                </div>
                                <div className="text-sm">
                                    Click the <strong>pin icon</strong> (<Pin className="h-3.5 w-3.5 inline-block mx-0.5" />)
                                    next to the extension name. The Surdej icon will now appear permanently in your toolbar.
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                                <strong>Tip:</strong> Clicking the Surdej icon in the toolbar opens the AI side panel.
                                You can also right-click the icon for quick actions.
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Options & Configuration ──────────────────────── */}
            <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Settings className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{t('extensionDownload.optionsTitle')}</h2>
                </div>

                <Card>
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                            Access the extension's Options page to configure your Surdej experience.
                            To open Options:
                        </p>

                        <div className="space-y-3 mb-6">
                            <div className="p-3 rounded-lg border bg-muted/20">
                                <div className="font-medium text-xs mb-1">Via Browser Menu</div>
                                <p className="text-xs text-muted-foreground">
                                    Right-click the Surdej icon in the toolbar → <strong>Options</strong>
                                </p>
                            </div>
                            <div className="p-3 rounded-lg border bg-muted/20">
                                <div className="font-medium text-xs mb-1">Via Extensions Page</div>
                                <p className="text-xs text-muted-foreground">
                                    Go to <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">chrome://extensions</code> →
                                    find Surdej → click <strong>Details</strong> → <strong>Extension options</strong>
                                </p>
                            </div>
                        </div>

                        <Separator className="my-5" />

                        <h3 className="font-semibold text-sm mb-3">What You Can Configure</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <FeatureCard
                                icon={Globe2}
                                title="API Endpoint"
                                description="Point the extension to your production or local dev API server."
                            />
                            <FeatureCard
                                icon={Shield}
                                title="Site Permissions"
                                description="Control which websites the extension can access and interact with."
                            />
                            <FeatureCard
                                icon={Eye}
                                title="Side Panel Behavior"
                                description="Configure how the AI side panel opens and displays on different sites."
                            />
                            <FeatureCard
                                icon={Grip}
                                title="Context Tools"
                                description="Enable or disable AI-powered tools for specific website types."
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Available Versions ───────────────────────────── */}
            <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Package className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{t('extensionDownload.versionsTitle')}</h2>
                </div>

                {!manifest || manifest.versions.length === 0 ? (
                    <Card>
                        <CardContent className="p-6 text-center text-sm text-muted-foreground">
                            No extension builds available yet.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {visibleVersions.map((v, i) => (
                            <Card
                                key={v.version}
                                className={cn(
                                    'transition-all duration-200 hover:shadow-md',
                                    i === 0 && 'ring-1 ring-primary/20',
                                )}
                            >
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-sm">v{v.version}</span>
                                            {i === 0 && (
                                                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                                                    {t('extensionDownload.latest')}
                                                </Badge>
                                            )}
                                            {installedVersion === v.version && (
                                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                                    {t('extensionDownload.installedBadge')}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{v.notes}</p>
                                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                                            <CalendarDays className="h-3 w-3" />
                                            <span>{v.date}</span>
                                        </div>
                                    </div>
                                    <a
                                        href={`/extensions/${v.filename}`}
                                        download
                                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-xs font-medium transition-colors"
                                    >
                                        <Download className="h-3 w-3" />
                                        Download
                                    </a>
                                </CardContent>
                            </Card>
                        ))}

                        {(manifest?.versions.length ?? 0) > 3 && (
                            <button
                                onClick={() => setShowAllVersions(!showAllVersions)}
                                className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showAllVersions ? (
                                    <>Show Less <ChevronUp className="h-3 w-3" /></>
                                ) : (
                                    <>Show All ({manifest!.versions.length} versions) <ChevronDown className="h-3 w-3" /></>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Updating the Extension ───────────────────────── */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center">
                        <ArrowRight className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{t('extensionDownload.updateTitle')}</h2>
                </div>

                <Card>
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                            To update to a new version:
                        </p>
                        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                            <li>Download the latest version from above</li>
                            <li>Go to <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">chrome://extensions</code></li>
                            <li>Remove the old extension by clicking <strong>Remove</strong></li>
                            <li>Drag &amp; drop the new <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">.zip</code> file onto the page</li>
                        </ol>
                        <div className="mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                                Your settings and permissions will be preserved when you reinstall. If you used the
                                "Load unpacked" method, you can simply replace the folder contents and click the
                                refresh button on the extensions page.
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
