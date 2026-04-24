/**
 * Converter Page — Modernise Old Knitting Patterns
 *
 * Converts traditional knitting patterns (knitted in separate pieces, bottom-up,
 * sewn together) into modern top-down, seamless construction.
 *
 * Uses the platform AI chat endpoint to perform the conversion via a specialised
 * system prompt for knitting pattern transformation.
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
    RefreshCw, ArrowLeft, Loader2, ClipboardPaste, Copy, CheckCircle2,
    ArrowDownUp, Scissors, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BASE_URL, api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConversionTechnique = 'top-down-seamless' | 'top-down-raglan' | 'top-down-yoke';

interface TechniqueOption {
    value: ConversionTechnique;
    label: string;
    description: string;
}

const TECHNIQUE_OPTIONS: TechniqueOption[] = [
    {
        value: 'top-down-seamless',
        label: 'Oppefra og ned — Sømløs',
        description: 'Strikkes i ét stykke fra halskanten ned. Ingen sammensyning.',
    },
    {
        value: 'top-down-raglan',
        label: 'Oppefra og ned — Raglan',
        description: 'Raglan-udtagninger fra halskanten. Klassisk top-down konstruktion.',
    },
    {
        value: 'top-down-yoke',
        label: 'Oppefra og ned — Rundt bærestykke',
        description: 'Cirkulært bærestykke med mønsterudtagninger. Populær islandsk teknik.',
    },
];

type Step = 'input' | 'converting' | 'result';

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(technique: ConversionTechnique): string {
    const techniqueLabels: Record<ConversionTechnique, string> = {
        'top-down-seamless': 'oppefra og ned i ét stykke (sømløs)',
        'top-down-raglan': 'oppefra og ned med raglan-udtagninger',
        'top-down-yoke': 'oppefra og ned med rundt bærestykke (yoke)',
    };

    return `Du er en erfaren strikkeekspert, der specialiserer sig i at konvertere traditionelle strikkeopskrifter til moderne teknikker.

Din opgave:
Konvertér den givne strikkeopskrift til en moderne opskrift, der strikkes ${techniqueLabels[technique]}.

Regler:
- Bevar alle mål, masketal og den originale garntype
- Omregn alle dele (forstykke, ryg, ærmer) til ét sammenhængende stykke
- Fjern alle sammensyningsinstruktioner og erstat med sammenføjning undervejs
- Tilpas udtagninger og tiltagninger til den valgte teknik
- Brug tydelige sektionsoverskrifter (Bærestykke / Krop / Ærmer / Kant)
- Skriv opskriften på dansk med tydelige og præcise instruktioner
- Bevar strikkefasthed (gauge) og nåle-anbefalinger
- Medtag eventuelle mønstergentagelser tilpasset cirkulær strikning
- Hvis originalen angiver størrelse(r), bevar alle størrelser

Formatér outputtet som en klar, komplet strikkeopskrift klar til brug.`;
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('surdej_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const tenantId = api.getTenantId();
    if (tenantId) headers['X-Tenant-Id'] = tenantId;
    return headers;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConverterPage() {
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>('input');
    const [inputText, setInputText] = useState('');
    const [technique, setTechnique] = useState<ConversionTechnique>('top-down-seamless');
    const [result, setResult] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const selectedTechnique = TECHNIQUE_OPTIONS.find((t) => t.value === technique)!;

    // ─── Convert via AI ───

    const handleConvert = useCallback(async () => {
        if (!inputText.trim()) return;

        setStep('converting');
        setResult('');
        setError(null);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const response = await fetch(`${BASE_URL}/ai/chat`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    message: `Konvertér følgende strikkeopskrift:\n\n${inputText}`,
                    systemPrompt: buildSystemPrompt(technique),
                    model: 'medium',
                }),
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                throw new Error(`Konvertering fejlede (${response.status})`);
            }

            // Parse SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6);

                    try {
                        const event = JSON.parse(jsonStr);

                        if (event.type === 'text') {
                            accumulated += event.content;
                            setResult(accumulated);
                        } else if (event.type === 'error') {
                            throw new Error(event.error);
                        }
                    } catch (e) {
                        if (e instanceof SyntaxError) continue;
                        throw e;
                    }
                }
            }

            setStep('result');
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Ukendt fejl under konvertering');
            setStep('result');
        }
    }, [inputText, technique]);

    // ─── Cancel ───

    const handleCancel = useCallback(() => {
        abortRef.current?.abort();
        setStep('input');
    }, []);

    // ─── New Conversion ───

    const handleReset = useCallback(() => {
        setStep('input');
        setResult('');
        setError(null);
        setCopied(false);
    }, []);

    // ─── Copy Result ───

    const handleCopy = useCallback(async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = result;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [result]);

    // ─── Paste from Clipboard ───

    const handlePaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) setInputText(text);
        } catch {
            // Permission denied — user can paste manually
        }
    }, []);

    // ─── Render ───

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => navigate('/modules')}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    aria-label="Tilbage"
                >
                    <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <RefreshCw className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Opskrift-Konverter</h1>
                        <p className="text-sm text-muted-foreground">
                            Modernisér gamle strikkeopskrifter til oppefra-og-ned teknik
                        </p>
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <Card className="mb-6 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="py-4 flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-medium mb-1">Sådan bruger du konverteren</p>
                        <p className="text-blue-700 dark:text-blue-400">
                            Indsæt din gamle strikkeopskrift (forstykke, ryg, ærmer osv.) i tekstfeltet nedenfor.
                            Vælg hvilken moderne teknik du ønsker, og tryk &quot;Konvertér&quot;.
                            AI&apos;en vil omskrive opskriften til en moderne version i ét stykke.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Input Step ─── */}
            {step === 'input' && (
                <div className="space-y-6">
                    {/* Technique Selector */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ArrowDownUp className="h-4 w-4" />
                                Vælg moderne teknik
                            </CardTitle>
                            <CardDescription>
                                Hvilken konstruktionsmetode skal opskriften konverteres til?
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select
                                value={technique}
                                onValueChange={(v) => setTechnique(v as ConversionTechnique)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TECHNIQUE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-2">
                                {selectedTechnique.description}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Pattern Input */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Scissors className="h-4 w-4" />
                                        Indsæt original opskrift
                                    </CardTitle>
                                    <CardDescription>
                                        Kopier hele den gamle opskrift ind herunder — inkl. alle dele
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePaste}
                                    className="shrink-0"
                                >
                                    <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
                                    Indsæt
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={'Indsæt din strikkeopskrift her...\n\nEksempel:\nRyg:\nSlå 120 m op på p. 4.\nStrik 5 cm rib (1r, 1vr).\nSkift til p. 5 og strik glat...\n\nForstykke:\n...\n\nÆrmer (strik 2 ens):\n...'}
                                className="min-h-[300px] font-mono text-sm"
                            />
                            <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-muted-foreground">
                                    {inputText.length > 0 ? `${inputText.length} tegn` : 'Ingen tekst endnu'}
                                </span>
                                <Button
                                    onClick={handleConvert}
                                    disabled={!inputText.trim()}
                                    className="gap-2"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Konvertér opskrift
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ─── Converting Step ─── */}
            {step === 'converting' && (
                <Card>
                    <CardContent className="py-12">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="relative">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold text-lg">Konverterer opskrift…</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    AI&apos;en omskriver din opskrift til{' '}
                                    <span className="font-medium">{selectedTechnique.label.toLowerCase()}</span>
                                </p>
                            </div>
                            {/* Live preview of the streaming result */}
                            {result && (
                                <div className="w-full mt-4 text-left">
                                    <div className="rounded-lg border bg-muted/30 p-4 max-h-[400px] overflow-y-auto">
                                        <pre className="text-sm whitespace-pre-wrap font-mono">
                                            {result}
                                        </pre>
                                    </div>
                                </div>
                            )}
                            <Button variant="outline" size="sm" onClick={handleCancel} className="mt-2">
                                Annullér
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Result Step ─── */}
            {step === 'result' && (
                <div className="space-y-4">
                    {error ? (
                        <Card className="border-destructive">
                            <CardContent className="py-8">
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                                        <RefreshCw className="h-6 w-6 text-destructive" />
                                    </div>
                                    <p className="font-semibold">Konvertering fejlede</p>
                                    <p className="text-sm text-muted-foreground max-w-md">{error}</p>
                                    <Button onClick={handleReset} className="mt-2">
                                        Prøv igen
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Success Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    <span className="font-semibold">Konvertering fuldført</span>
                                    <Badge variant="outline">{selectedTechnique.label}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={handleCopy}>
                                        {copied ? (
                                            <>
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                                                Kopieret!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-3.5 w-3.5 mr-1.5" />
                                                Kopiér
                                            </>
                                        )}
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleReset}>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                        Ny konvertering
                                    </Button>
                                </div>
                            </div>

                            {/* Result Card */}
                            <Card>
                                <CardContent className="py-4">
                                    <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                                        {result}
                                    </pre>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
