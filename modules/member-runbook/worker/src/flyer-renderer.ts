/**
 * Flyer Renderer — Generates print-ready A4 folded flyer HTML
 *
 * Follows the Nordic Kitchen pattern from flyer-surdej-init.html:
 * - Page 1 (outside): Back Cover (left) + Front Cover (right)
 * - Page 2 (inside, rotated 180°): Inside Left + Inside Right
 * - A4 landscape, fold in half → A5 4-page booklet
 *
 * The renderer takes a Runbook + FlyerLayout and produces standalone HTML.
 */

import type { Runbook, FlyerLayout, BackCoverConfig, ColorPalette } from '@surdej/module-member-runbook-shared';

// ─── Happy Mates SVG Logo ──────────────────────────────────────

const HAPPY_MATES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 750">
    <defs>
        <linearGradient id="hmGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#E63946" />
            <stop offset="25%" stop-color="#F77F00" />
            <stop offset="50%" stop-color="#FCBF49" />
            <stop offset="75%" stop-color="#06D6A0" />
            <stop offset="100%" stop-color="#118AB2" />
        </linearGradient>
    </defs>
    <circle cx="375" cy="375" r="300" fill="url(#hmGradient)" />
    <circle cx="375" cy="375" r="200" fill="transparent" stroke="white" stroke-width="20" />
    <circle cx="330" cy="330" r="30" fill="white" />
    <circle cx="420" cy="300" r="30" fill="white" />
    <path d="M 310 410 Q 375 470 440 410" stroke="white" stroke-width="25" fill="none" stroke-linecap="round" />
</svg>`;

// ─── Default Layouts ───────────────────────────────────────────

export const DEFAULT_LAYOUTS = {
    'happy-mates-nordic': {
        name: 'Happy Mates Nordic Kitchen',
        slug: 'happy-mates-nordic',
        scope: 'common' as const,
        businessUnit: 'happy-mates',
        backCoverConfig: {
            name: '/surdej - Den Digitale Grunddej',
            role: 'AI Arbejdsprocesser',
            bio: 'Ligesom en bager har sin surdej, der viderebringer viden, æstetik og smag fra brød til brød — har vi skabt "/surdej". Det er en serie af præcise arbejdsinstruktioner (kaldet prompts eller workflows), som AI agenten bruger til systematisk og ensartet at udføre komplekse opgaver.',
            contact: {
                email: 'niels@happymates.dk',
                phone: '+45 22 80 37 50',
                website: 'happymates.dk/surdej',
                location: 'Det Nordiske Køkken',
            },
            csrText: 'Happy Mates er en forening der hjælper unge med at finde fællesskab, mening og færdigheder — gennem sport, teknologi og ægte håndværk. Vi tror på at skabe fra bunden.',
            websiteUrl: 'happymates.dk',
        },
        frontCoverConfig: {
            overlayGradient: 'linear-gradient(to bottom, rgba(28,26,24,0.6) 0%, rgba(28,26,24,0) 30%, rgba(28,26,24,0) 60%, rgba(28,26,24,0.8) 100%)',
            titleFontFamily: 'Space Grotesk',
            titleFontSize: '42px',
            footerBrandName: 'Happy Mates',
        },
        insideConfig: {
            leftBg: '#FAF7F2',
            rightBg: '#FFFFFF',
            accentColor: '#6C7A65',
            quoteStyle: 'border-left' as const,
        },
        colorPalette: {
            primary: '#3E332A',     // Wood
            secondary: '#FAF7F2',   // Wheat
            accent: '#6C7A65',      // Olive
            background: '#E6E0D3', // Sand
            text: '#1C1A18',       // Charcoal
            sand: '#E6E0D3',
            stone: '#D4D0C9',
        },
    },
};

// ─── Render Helpers ────────────────────────────────────────────

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderContactRow(icon: string, text: string): string {
    return `<div class="contact-row"><span class="contact-icon">${icon}</span><span>${escapeHtml(text)}</span></div>`;
}

function renderSteps(steps: Array<{ number: number; title: string; description: string; icon?: string }>): string {
    return steps.map(step => `
        <div class="value-item">
            <div style="font-size: 16px; margin-right: 2px;">${step.icon || `${step.number}️⃣`}</div>
            <div>
                <h4>${escapeHtml(step.title)}</h4>
                <p>${escapeHtml(step.description)}</p>
            </div>
        </div>
    `).join('');
}

// ─── Main Renderer ─────────────────────────────────────────────

interface RenderOptions {
    runbook: Runbook;
    layout: typeof DEFAULT_LAYOUTS['happy-mates-nordic'];
    heroImageUrl?: string;
    insideImageUrl?: string;
    backLogoUrl?: string;
    markdownHtml?: string;  // Pre-rendered markdown content
}

export function renderFlyerHtml(options: RenderOptions): string {
    const { runbook, layout, heroImageUrl, insideImageUrl, backLogoUrl, markdownHtml } = options;
    const palette = layout.colorPalette;
    const back = layout.backCoverConfig as BackCoverConfig;
    const front = layout.frontCoverConfig;
    const inside = layout.insideConfig;
    const steps = (runbook.metadata as any)?.steps || [];
    const quote = (runbook.metadata as any)?.quote || '';

    return `<!DOCTYPE html>
<html lang="da">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>/${runbook.slug} – ${runbook.title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --nk-primary: ${palette.primary};
            --nk-secondary: ${palette.secondary};
            --nk-accent: ${palette.accent};
            --nk-background: ${palette.background};
            --nk-text: ${palette.text};
            --nk-sand: ${palette.sand || palette.background};
            --nk-stone: ${palette.stone || '#D4D0C9'};
            --panel-width: 148.5mm;
            --panel-height: 210mm;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, sans-serif; background: #e0e0e0; color: var(--nk-text); }
        
        .page-label { text-align: center; padding: 12px; font-size: 13px; color: #666; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; }
        
        .print-sheet { width: 297mm; height: 210mm; margin: 16px auto; display: flex; background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.15); overflow: hidden; position: relative; }
        .print-sheet.rotated { transform: rotate(180deg); }
        .print-sheet::after { content: ''; position: absolute; top: 0; left: 50%; width: 1px; height: 100%; background: repeating-linear-gradient(to bottom, #ccc 0, #ccc 4px, transparent 4px, transparent 8px); z-index: 100; pointer-events: none; }
        
        .panel { width: var(--panel-width); height: var(--panel-height); overflow: hidden; position: relative; }

        /* Back Cover */
        .panel-back { background: var(--nk-secondary); color: var(--nk-text); display: flex; flex-direction: column; justify-content: space-between; padding: 10mm 8mm; border-right: 1px solid var(--nk-sand); }
        .back-top { display: flex; gap: 5mm; align-items: flex-start; }
        .back-top .back-logo { width: 42mm; height: 42mm; flex-shrink: 0; display: block; overflow: hidden; border-radius: 4mm; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .back-top .back-logo img { width: 100%; height: 100%; object-fit: cover; }
        .back-top .back-caption { flex: 1; min-width: 0; }
        .back-top .back-caption strong { display: block; font-family: '${front.titleFontFamily || 'Space Grotesk'}', sans-serif; color: var(--nk-primary); font-size: 12px; font-weight: 700; margin-bottom: 1.5mm; }
        .back-top .back-caption .back-role { font-size: 8px; font-weight: 600; color: var(--nk-accent); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2mm; display: block; }
        .back-top .back-caption .back-bio { font-size: 8.5px; color: #555; line-height: 1.55; }
        .back-contact { background: white; border-radius: 4mm; padding: 6mm; margin-top: 4mm; border: 1px solid var(--nk-sand); }
        .back-contact h3 { font-family: '${front.titleFontFamily || 'Space Grotesk'}', sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--nk-accent); margin-bottom: 4mm; font-weight: 700; }
        .contact-row { display: flex; align-items: center; gap: 3mm; margin-bottom: 2.5mm; font-size: 10px; color: var(--nk-primary); line-height: 1.4; }
        .contact-icon { width: 18px; height: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; }
        .back-bottom { text-align: center; }
        .back-bottom .website { font-family: '${front.titleFontFamily || 'Space Grotesk'}', sans-serif; font-size: 16px; font-weight: 700; color: var(--nk-accent); letter-spacing: 0.02em; }
        .back-csr { background: rgba(${hexToRgb(palette.accent)}, 0.06); border: 1px solid rgba(${hexToRgb(palette.accent)}, 0.15); border-radius: 4mm; padding: 4mm 5mm; margin-top: 5mm; }
        .back-csr p { font-size: 8.5px; color: #555; line-height: 1.5; text-align: center; }
        .back-csr strong { color: var(--nk-accent); }

        /* Front Cover */
        .panel-front { background: var(--nk-primary); color: white; display: flex; flex-direction: column; position: relative; }
        .front-hero { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; z-index: 1; }
        .front-hero img { width: 100%; height: 100%; object-fit: cover; object-position: center bottom; }
        .front-hero-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: ${front.overlayGradient || 'linear-gradient(to bottom, rgba(28,26,24,0.6) 0%, rgba(28,26,24,0) 30%, rgba(28,26,24,0) 60%, rgba(28,26,24,0.8) 100%)'}; z-index: 2; }
        .front-content { flex: 1; display: flex; flex-direction: column; justify-content: space-between; align-items: center; position: relative; z-index: 3; padding: 15mm 10mm; height: 100%; }
        .front-title-container { text-align: center; }
        .front-title { font-family: '${front.titleFontFamily || 'Space Grotesk'}', sans-serif; font-size: ${front.titleFontSize || '42px'}; font-weight: 800; letter-spacing: -0.05em; line-height: 1.1; margin-bottom: 2mm; color: white; }
        .front-subtitle { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.85); letter-spacing: 0.15em; text-transform: uppercase; }
        .front-footer { display: flex; flex-direction: column; align-items: center; gap: 2mm; }
        .front-footer-brand { display: flex; align-items: center; gap: 2mm; }
        .front-footer svg { width: 6mm; height: 6mm; }
        .front-footer .hm-name { font-family: '${front.titleFontFamily || 'Space Grotesk'}', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: white; opacity: 0.9; }

        /* Inside Panels */
        .panel-inside-left { background: ${inside.leftBg}; padding: 10mm; display: flex; flex-direction: column; justify-content: flex-start; }
        .panel-inside-right { background: ${inside.rightBg}; padding: 10mm; display: flex; flex-direction: column; justify-content: space-between; }
        .inside-header { margin-bottom: 6mm; }
        .inside-header h2 { font-family: '${front.titleFontFamily || 'Space Grotesk'}', sans-serif; font-size: 20px; font-weight: 800; color: var(--nk-text); margin-bottom: 3mm; }
        .inside-header .accent-line { width: 20mm; height: 3px; background: var(--nk-accent); border-radius: 2px; }
        .inside-intro { font-size: 12px; line-height: 1.7; color: var(--nk-primary); margin-bottom: 6mm; }
        .inside-text { font-size: 10.5px; line-height: 1.6; color: #444; margin-bottom: 4mm; }
        .inside-quote { padding: 4mm 5mm; border-left: 2px solid var(--nk-accent); background: rgba(${hexToRgb(palette.accent)}, 0.05); font-style: italic; font-size: 11px; color: var(--nk-primary); margin-bottom: 6mm; }
        .inside-right-photo { width: 100%; height: 70mm; border-radius: 3mm; overflow: hidden; margin-bottom: 6mm; }
        .inside-right-photo img { width: 100%; height: 100%; object-fit: cover; }
        .values-box { background: var(--nk-secondary); border-radius: 3mm; padding: 5mm; border: 1px solid var(--nk-sand); }
        .values-title { font-family: '${front.titleFontFamily || 'Space Grotesk'}', sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--nk-accent); margin-bottom: 3mm; }
        .value-item { display: flex; align-items: flex-start; gap: 3mm; margin-bottom: 3mm; }
        .value-item:last-child { margin-bottom: 0; }
        .value-item h4 { font-family: '${front.titleFontFamily || 'Space Grotesk'}', sans-serif; font-size: 11px; font-weight: 700; color: var(--nk-text); margin-bottom: 0.5mm; }
        .value-item p { font-size: 9px; color: #555; line-height: 1.4; }

        /* Print */
        @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { background: white; }
            .page-label, .print-instructions, .toggle-row { display: none !important; }
            .print-sheet { margin: 0; box-shadow: none; page-break-after: always; }
            .print-sheet::after { display: none; }
            @page { size: A4 landscape; margin: 0; }
        }

        .toggle-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #ffe082; }
        .toggle-label { font-size: 13px; font-weight: 600; color: #5d4037; }
        .toggle-label small { font-weight: 400; color: #8d6e63; }
        .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 24px; transition: 0.25s; }
        .toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.25s; }
        .toggle-switch input:checked + .toggle-slider { background: var(--nk-accent); }
        .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); }
    </style>
    <script>
        function toggleRotation() {
            const sheet = document.getElementById('insideSheet');
            const cb = document.getElementById('rotateToggle');
            if (cb.checked) { sheet.classList.add('rotated'); } else { sheet.classList.remove('rotated'); }
        }
    </script>
</head>
<body>

    <div class="print-instructions" style="max-width: 297mm; margin: 16px auto; padding: 16px 24px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #5d4037;">
        <h3 style="font-family: '${front.titleFontFamily || 'Space Grotesk'}', sans-serif; margin-bottom: 8px; color: #3e2723;">🖨️ Udskrivningsinstruktioner</h3>
        <p>
            <strong>Side 1</strong> (ydersiderne): Venstre panel = Bagside | Højre panel = Forside<br>
            <strong>Side 2</strong> (indersiderne): Venstre panel = Inderside venstre | Højre panel = Inderside højre<br><br>
            Udskriv med <code>Ctrl+P</code> / <code>⌘P</code> → vælg <strong>A4 Liggende</strong>, ingen marginer, og aktiver <strong>"Baggrundsfarver og -billeder"</strong>.
        </p>
    </div>

    <!-- PAGE 1: OUTSIDE (Back + Front) -->
    <div class="page-label">Side 1 — Yderside (Bagside venstre · Forside højre)</div>
    <div class="print-sheet">

        <!-- BACK COVER -->
        <div class="panel panel-back">
            <div class="back-top">
                ${backLogoUrl ? `<div class="back-logo"><img src="${backLogoUrl}" alt="Logo"></div>` : ''}
                <div class="back-caption">
                    <strong>${escapeHtml(back.name || '')}</strong>
                    ${back.role ? `<span class="back-role">${escapeHtml(back.role)}</span>` : ''}
                    ${back.bio ? `<span class="back-bio">${escapeHtml(back.bio)}</span>` : ''}
                </div>
            </div>

            ${back.contact ? `
            <div class="back-contact">
                <h3>Kontakt &amp; Information</h3>
                ${back.contact.email ? renderContactRow('📧', back.contact.email) : ''}
                ${back.contact.phone ? renderContactRow('📱', back.contact.phone) : ''}
                ${back.contact.website ? renderContactRow('🌐', back.contact.website) : ''}
                ${back.contact.location ? renderContactRow('📍', back.contact.location) : ''}
            </div>` : ''}

            ${back.csrText ? `
            <div class="back-csr">
                <p>${back.csrText}</p>
            </div>` : ''}

            <div class="back-bottom">
                <div class="website">${escapeHtml(back.websiteUrl || '')}</div>
            </div>
        </div>

        <!-- FRONT COVER -->
        <div class="panel panel-front">
            ${heroImageUrl ? `
            <div class="front-hero">
                <img src="${heroImageUrl}" alt="Hero Image">
                <div class="front-hero-overlay"></div>
            </div>` : ''}
            <div class="front-content">
                <div class="front-title-container">
                    <h1 class="front-title">/${escapeHtml(runbook.slug)}</h1>
                    ${runbook.subtitle ? `<div class="front-subtitle">${escapeHtml(runbook.subtitle)}</div>` : ''}
                </div>
                <div class="front-footer">
                    <div class="front-footer-brand">
                        ${HAPPY_MATES_SVG}
                        <span class="hm-name">${escapeHtml(front.footerBrandName || 'Happy Mates')}</span>
                    </div>
                </div>
            </div>
        </div>

    </div>

    <!-- PAGE 2: INSIDE SPREAD -->
    <div class="page-label" style="display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; margin-top: 20px;">
        Side 2 — Inderside (Venstre · Højre)
        <div class="toggle-row" style="margin-top: 0; padding-top: 0; border-top: none;">
            <label class="toggle-switch">
                <input type="checkbox" id="rotateToggle" checked onchange="toggleRotation()">
                <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Rotér 180° <small>(dobbeltsidet print)</small></span>
        </div>
    </div>
    <div id="insideSheet" class="print-sheet rotated">

        <!-- INSIDE LEFT -->
        <div class="panel panel-inside-left">
            <div class="inside-header">
                <h2>${escapeHtml(runbook.title)}</h2>
                <div class="accent-line"></div>
            </div>

            ${runbook.description ? `<p class="inside-intro">${escapeHtml(runbook.description)}</p>` : ''}

            ${quote ? `<div class="inside-quote">"${escapeHtml(quote)}"</div>` : ''}

            ${markdownHtml ? `<div class="inside-text">${markdownHtml}</div>` : ''}
        </div>

        <!-- INSIDE RIGHT -->
        <div class="panel panel-inside-right">
            <div>
                <div class="inside-header">
                    <h2>Trin for Trin</h2>
                    <div class="accent-line"></div>
                </div>
                ${insideImageUrl ? `
                <div class="inside-right-photo">
                    <img src="${insideImageUrl}" alt="Workflow illustration">
                </div>` : ''}
            </div>

            ${steps.length > 0 ? `
            <div class="values-box">
                <div class="values-title">Workflowets opgaver</div>
                ${renderSteps(steps)}
            </div>` : ''}
        </div>

    </div>
</body>
</html>`;
}

// ─── Helper: hex to rgb ────────────────────────────────────────

function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '128, 128, 128';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
