import { useState, useEffect } from 'react';
import { useMentalKlarhedApi } from '../../hooks/useMentalKlarhedApi.js';
import type { PreSessionMaterial } from '@surdej/module-mental-klarhed-shared';

function downloadPdfFromMarkdown(markdownContent: string, filename: string) {
    // Convert markdown to simple HTML, open in new tab so user can print/save as PDF
    const html = markdownContent
        .split('\n')
        .map(line => {
            if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
            if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
            if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
            if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
            if (line.trim() === '') return '<br>';
            return `<p>${line}</p>`;
        })
        .join('\n');

    const page = `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<title>${filename}</title>
<style>
  body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; line-height: 1.7; }
  h1 { font-size: 22px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
  h2 { font-size: 17px; margin-top: 24px; }
  h3 { font-size: 14px; color: #444; }
  p { font-size: 13px; margin: 6px 0; }
  li { font-size: 13px; margin: 3px 0; }
  @media print { body { margin: 20mm; } }
</style>
</head>
<body>${html}</body>
</html>`;

    const blob = new Blob([page], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
        win.addEventListener('load', () => {
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        });
    }
}

interface Props {
    programmeId: string;
    sessionNumber: number;
    onBack?: () => void;
}

export function MaterialReview({ programmeId, sessionNumber, onBack }: Props) {
    const api = useMentalKlarhedApi();
    const [material, setMaterial] = useState<PreSessionMaterial | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pdf' | 'video'>('pdf');

    useEffect(() => {
        api.getSessionMaterial(programmeId, sessionNumber)
            .then(setMaterial)
            .finally(() => setLoading(false));
    }, [programmeId, sessionNumber]);

    if (loading) return <div className="p-6 text-muted-foreground">Indlæser materiale...</div>;
    if (!material) return <div className="p-6 text-muted-foreground">Materiale ikke tilgængeligt endnu.</div>;

    return (
        <div className="p-6 space-y-4 max-w-2xl">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Tilbage</button>
                <h2 className="text-xl font-semibold">Materiale — Session {sessionNumber}</h2>
            </div>

            <div className="text-xs text-muted-foreground">
                Genereret: {new Date(material.generatedAt).toLocaleString('da-DK')}
                {material.sentAt && ` · Sendt: ${new Date(material.sentAt).toLocaleString('da-DK')}`}
            </div>

            <div className="flex gap-2 border-b">
                {(['pdf', 'video'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
                            activeTab === tab
                                ? 'border-primary text-primary font-medium'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {tab === 'pdf' ? 'PDF-indhold (refleksionsopgaver)' : 'Videomanus (90 sek.)'}
                    </button>
                ))}
            </div>

            <div className="border rounded-lg p-4 bg-muted/30 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                {activeTab === 'pdf' ? material.pdfContent : material.videoScript}
            </div>

            {material.pdfUrl ? (
                <a
                    href={material.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm px-4 py-2 border rounded-md hover:bg-muted"
                >
                    Download PDF
                </a>
            ) : (
                <button
                    onClick={() => downloadPdfFromMarkdown(material.pdfContent ?? '', `session-${sessionNumber}.pdf`)}
                    className="inline-block text-sm px-4 py-2 border rounded-md hover:bg-muted"
                >
                    Download PDF
                </button>
            )}
        </div>
    );
}
