/**
 * IdCardPrinterPage
 *
 * Web port of the printer_kortprogram Electron app.
 * Designs and prints CR80 ID cards (85.6mm × 54mm) with:
 *   - Photo upload / webcam capture
 *   - QR code generation (auto from fields or custom)
 *   - 4 card templates, 7 font options, company logo
 *   - Drag-to-reposition + right-click-drag-to-resize elements
 *   - Element visibility toggles
 *   - Unlimited custom text elements
 *   - Save/load layout presets as JSON
 *   - Export card as PNG download
 *   - Print via browser print dialog
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CreditCard, Camera, Upload, X, Printer, Download, RotateCcw, Plus, Eye, EyeOff, Save, FolderOpen, RefreshCw, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ElementStyles {
    top?: string;
    left?: string;
    right?: string;
    bottom?: string;
    width?: string;
    height?: string;
    fontSize?: string;
}

interface CustomTextItem {
    id: string;
    content: string;
}

interface PresetData {
    version: string;
    template: string;
    font: string;
    showQrCode: boolean;
    qrContentType: string;
    elementStyles: Record<string, ElementStyles>;
    visibility: Record<string, boolean>;
    customTextElements: { id: string; content: string; style: ElementStyles }[];
}

// ─── Default layout positions (from the Electron app's getDefaultLayout) ───

const DEFAULT_LAYOUT: Record<string, ElementStyles> = {
    logo:        { top: '150px', left: '3px',   right: 'auto', bottom: 'auto', width: '61px',  height: '61px'   },
    companyName: { top: '23px',  left: '61px',  right: 'auto', bottom: 'auto', width: 'auto',  height: 'auto',  fontSize: '17px'   },
    photo:       { top: '14px',  left: '200px', right: 'auto', bottom: 'auto', width: '123px', height: '185px'  },
    firstName:   { top: '79px',  left: '52px',  right: 'auto', bottom: 'auto', width: 'auto',  height: 'auto',  fontSize: '30px'   },
    lastName:    { top: '60px',  left: '140px', right: 'auto', bottom: 'auto', width: 'auto',  height: 'auto',  fontSize: '18px'   },
    title:       { top: '154px', left: '101px', right: 'auto', bottom: 'auto', width: 'auto',  height: 'auto',  fontSize: '12px'   },
    department:  { top: '169px', left: '66px',  right: 'auto', bottom: 'auto', width: 'auto',  height: 'auto',  fontSize: '11px'   },
    id:          { top: '184px', left: '118px', right: 'auto', bottom: 'auto', width: 'auto',  height: 'auto',  fontSize: '9px'    },
    qr:          { top: '3px',   left: '4px',   right: 'auto', bottom: 'auto', width: '55px',  height: '55px'   },
    expiry:      { top: '201px', left: '209px', right: 'auto', bottom: 'auto', width: 'auto',  height: 'auto',  fontSize: '10px'   },
};

const CARD_TEMPLATES: Record<string, { background: string; textColor: string; label: string }> = {
    modern:    { background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', textColor: '#ffffff', label: 'Modern Blue' },
    corporate: { background: 'linear-gradient(135deg, #374151 0%, #6b7280 100%)', textColor: '#ffffff', label: 'Corporate Gray' },
    minimal:   { background: '#ffffff', textColor: '#1e293b', label: 'Minimal White' },
    dark:      { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', textColor: '#ffffff', label: 'Dark Mode' },
};

const FONT_OPTIONS: { value: string; label: string }[] = [
    { value: 'system-ui, -apple-system, sans-serif',              label: 'System Default' },
    { value: "'Helvetica Neue', Helvetica, Arial, sans-serif",    label: 'Helvetica' },
    { value: "Georgia, 'Times New Roman', serif",                 label: 'Georgia' },
    { value: "'Courier New', Courier, monospace",                 label: 'Courier' },
    { value: "'Trebuchet MS', sans-serif",                        label: 'Trebuchet' },
    { value: 'Verdana, Geneva, sans-serif',                       label: 'Verdana' },
    { value: "'Palatino Linotype', 'Book Antiqua', serif",        label: 'Palatino' },
];

// ─── Helper: apply element styles to a DOM element ──────────────────────────

function applyStyles(el: HTMLElement, styles: ElementStyles) {
    if (styles.top    !== undefined) el.style.top    = styles.top;
    if (styles.left   !== undefined) el.style.left   = styles.left;
    if (styles.right  !== undefined) el.style.right  = styles.right;
    if (styles.bottom !== undefined) el.style.bottom = styles.bottom;
    if (styles.width  !== undefined) el.style.width  = styles.width;
    if (styles.height !== undefined) el.style.height = styles.height;
    if (styles.fontSize !== undefined) el.style.fontSize = styles.fontSize;
}

// ─── Component ────────────────────────────────────────────────────────────

export function IdCardPrinterPage() {
    // ── Form state ─────────────────────────────────────────────────────────
    const [companyName, setCompanyName] = useState('');
    const [firstName,   setFirstName]   = useState('');
    const [lastName,    setLastName]    = useState('');
    const [idNumber,    setIdNumber]    = useState('');
    const [title,       setTitle]       = useState('');
    const [department,  setDepartment]  = useState('');
    const [expiryDate,  setExpiryDate]  = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().split('T')[0];
    });

    // ── Photo / Logo ───────────────────────────────────────────────────────
    const [photoData, setPhotoData] = useState<string | null>(null);
    const [logoData,  setLogoData]  = useState<string | null>(null);

    // ── QR Code ────────────────────────────────────────────────────────────
    const [qrContentType, setQrContentType] = useState<'auto' | 'custom'>('auto');
    const [customQrContent, setCustomQrContent] = useState('');
    const [showQrCode, setShowQrCode] = useState(true);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    // ── Design ─────────────────────────────────────────────────────────────
    const [template, setTemplate] = useState<string>('minimal');
    const [font,     setFont]     = useState<string>('system-ui, -apple-system, sans-serif');

    // ── Interaction modes ──────────────────────────────────────────────────
    const [dragEnabled,   setDragEnabled]   = useState(true);
    const [resizeEnabled, setResizeEnabled] = useState(true);

    // ── Element visibility ─────────────────────────────────────────────────
    const [visibility, setVisibility] = useState<Record<string, boolean>>({
        logo: true, companyName: true, photo: true, firstName: true,
        lastName: true, title: true, department: true, id: true, expiry: true, qr: true,
    });

    // ── Custom text elements ───────────────────────────────────────────────
    const [customTexts, setCustomTexts] = useState<CustomTextItem[]>([]);
    const [newTextInput, setNewTextInput] = useState('');
    const customTextCounterRef = useRef(0);

    // ── Camera ─────────────────────────────────────────────────────────────
    const [showCamera,    setShowCamera]    = useState(false);
    const [cameraError,   setCameraError]   = useState<string | null>(null);
    const cameraStreamRef  = useRef<MediaStream | null>(null);
    const cameraVideoRef   = useRef<HTMLVideoElement>(null);
    const cameraCanvasRef  = useRef<HTMLCanvasElement>(null);

    // ── Print preview ──────────────────────────────────────────────────────
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const printPreviewCloneRef = useRef<HTMLDivElement>(null);

    // ── Notification ──────────────────────────────────────────────────────
    const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // ── Refs ───────────────────────────────────────────────────────────────
    const cardPreviewRef    = useRef<HTMLDivElement>(null);
    const photoInputRef     = useRef<HTMLInputElement>(null);
    const logoInputRef      = useRef<HTMLInputElement>(null);
    const presetInputRef    = useRef<HTMLInputElement>(null);

    // Mutable drag/resize state (no re-render needed during gesture)
    const dragStateRef = useRef<{
        el: HTMLElement | null;
        offsetX: number;
        offsetY: number;
        cardRect: DOMRect | null;
    }>({ el: null, offsetX: 0, offsetY: 0, cardRect: null });

    const resizeStateRef = useRef<{
        el: HTMLElement | null;
        startW: number;
        startH: number;
        startFS: number;
        startX: number;
        startY: number;
    }>({ el: null, startW: 0, startH: 0, startFS: 0, startX: 0, startY: 0 });

    // ─── Notifications ──────────────────────────────────────────────────────
    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3500);
    }, []);

    // ─── QR Code generation ─────────────────────────────────────────────────
    const regenerateQr = useCallback(async (
        qrType: string, customContent: string,
        fn: string, ln: string, idNum: string, ttl: string, dept: string,
    ) => {
        let content: string;
        if (qrType === 'custom') {
            content = customContent || 'https://example.com';
        } else {
            content = JSON.stringify({
                name: `${fn} ${ln}`.trim(),
                id: idNum,
                title: ttl,
                department: dept,
            });
        }
        try {
            const url = await QRCode.toDataURL(content, { width: 150, margin: 1 });
            setQrDataUrl(url);
        } catch (err) {
            console.error('QR code generation failed:', err);
            setQrDataUrl(null);
        }
    }, []);

    // Re-generate QR whenever relevant fields change
    useEffect(() => {
        if (!showQrCode) return;
        regenerateQr(qrContentType, customQrContent, firstName, lastName, idNumber, title, department);
    }, [showQrCode, qrContentType, customQrContent, firstName, lastName, idNumber, title, department, regenerateQr]);

    // ─── Apply default layout on mount ──────────────────────────────────────
    useEffect(() => {
        const card = cardPreviewRef.current;
        if (!card) return;
        Object.entries(DEFAULT_LAYOUT).forEach(([id, styles]) => {
            const el = card.querySelector<HTMLElement>(`[data-element="${id}"]`);
            if (el) applyStyles(el, styles);
        });
    }, []);

    // ─── Drag & Drop (event delegation on the card container) ───────────────
    const dragEnabledRef   = useRef(dragEnabled);
    const resizeEnabledRef = useRef(resizeEnabled);
    useEffect(() => { dragEnabledRef.current   = dragEnabled; },   [dragEnabled]);
    useEffect(() => { resizeEnabledRef.current = resizeEnabled; }, [resizeEnabled]);

    const handleCardMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!dragEnabledRef.current) return;
        // Walk up to find the nearest .icp-element
        let el = e.target as HTMLElement;
        while (el && el !== cardPreviewRef.current) {
            if (el.classList.contains('icp-element')) {
                e.preventDefault();
                el.classList.add('icp-dragging');
                const card = cardPreviewRef.current!;
                const cardRect = card.getBoundingClientRect();
                const elRect   = el.getBoundingClientRect();
                dragStateRef.current = {
                    el,
                    offsetX: e.clientX - elRect.left,
                    offsetY: e.clientY - elRect.top,
                    cardRect,
                };
                return;
            }
            el = el.parentElement as HTMLElement;
        }
    }, []);

    const handleCardContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!resizeEnabledRef.current) return;
        let el = e.target as HTMLElement;
        while (el && el !== cardPreviewRef.current) {
            if (el.classList.contains('icp-element')) {
                e.preventDefault();
                e.stopPropagation();
                el.classList.add('icp-resizing');
                const rect = el.getBoundingClientRect();
                const fs = parseFloat(getComputedStyle(el).fontSize) || 12;
                resizeStateRef.current = {
                    el,
                    startW: rect.width,
                    startH: rect.height,
                    startFS: fs,
                    startX: e.clientX,
                    startY: e.clientY,
                };
                return;
            }
            el = el.parentElement as HTMLElement;
        }
    }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const { el, offsetX, offsetY, cardRect } = dragStateRef.current;
            if (!el || !cardRect) return;
            const elRect = el.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - cardRect.left - offsetX, cardRect.width  - elRect.width));
            const y = Math.max(0, Math.min(e.clientY - cardRect.top  - offsetY, cardRect.height - elRect.height));
            el.style.left   = `${x}px`;
            el.style.top    = `${y}px`;
            el.style.right  = 'auto';
            el.style.bottom = 'auto';
        };
        const onUp = () => {
            const { el } = dragStateRef.current;
            if (el) el.classList.remove('icp-dragging');
            dragStateRef.current.el = null;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
        };
    }, []);

    // ─── Resize (right-click + drag) ─────────────────────────────────────────
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const { el, startW, startFS, startX, startY } = resizeStateRef.current;
            if (!el) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const elId = el.dataset.element || '';
            if (elId === 'photo') {
                const w = Math.max(30, startW + dx);
                el.style.width  = `${w}px`;
                el.style.height = `${w * 1.5}px`;
            } else if (elId === 'qr' || elId === 'logo') {
                const size = Math.max(20, startW + Math.max(dx, dy));
                el.style.width  = `${size}px`;
                el.style.height = `${size}px`;
            } else {
                const newFs = Math.max(8, Math.min(48, startFS + dy * 0.1));
                el.style.fontSize = `${newFs}px`;
                resizeStateRef.current.startY  = e.clientY;
                resizeStateRef.current.startFS = newFs;
            }
        };
        const onUp = () => {
            const { el } = resizeStateRef.current;
            if (el) el.classList.remove('icp-resizing');
            resizeStateRef.current.el = null;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
        };
    }, []);

    // ─── Reset layout ────────────────────────────────────────────────────────
    const resetLayout = useCallback(() => {
        const card = cardPreviewRef.current;
        if (!card) return;
        Object.entries(DEFAULT_LAYOUT).forEach(([id, styles]) => {
            const el = card.querySelector<HTMLElement>(`[data-element="${id}"]`);
            if (el) applyStyles(el, styles);
        });
        // Remove all custom text elements
        setCustomTexts([]);
    }, []);

    // ─── Print preview: populate clone without innerHTML (safe) ─────────────
    useEffect(() => {
        if (!showPrintPreview) return;
        const container = printPreviewCloneRef.current;
        const source    = cardPreviewRef.current;
        if (!container || !source) return;
        // Remove old clone if present
        while (container.firstChild) container.removeChild(container.firstChild);
        const clone = source.cloneNode(true) as HTMLElement;
        // Strip interactivity from clone (listeners are on source, not on clone)
        container.appendChild(clone);
    }, [showPrintPreview]);

    // ─── Photo upload (web: file input) ──────────────────────────────────────
    const handlePhotoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (typeof ev.target?.result === 'string') setPhotoData(ev.target.result);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, []);

    // ─── Logo upload ─────────────────────────────────────────────────────────
    const handleLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (typeof ev.target?.result === 'string') setLogoData(ev.target.result);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, []);

    // ─── Camera ──────────────────────────────────────────────────────────────
    const openCamera = useCallback(async () => {
        setCameraError(null);
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            cameraStreamRef.current = stream;
            if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
        } catch (err) {
            console.error('Camera access failed:', err);
            setCameraError('Kamera er ikke tilgængeligt. Tjek tilladelser og at kameraet ikke bruges af en anden applikation.');
        }
    }, []);

    const closeCamera = useCallback(() => {
        cameraStreamRef.current?.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
        setShowCamera(false);
    }, []);

    const capturePhoto = useCallback(() => {
        const video  = cameraVideoRef.current;
        const canvas = cameraCanvasRef.current;
        if (!video || !canvas) return;
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        setPhotoData(canvas.toDataURL('image/jpeg', 0.9));
        closeCamera();
    }, [closeCamera]);

    // ─── Custom text elements ────────────────────────────────────────────────
    const addCustomText = useCallback(() => {
        const text = newTextInput.trim();
        if (!text) return;
        const id = `customText${++customTextCounterRef.current}`;
        setCustomTexts(prev => [...prev, { id, content: text }]);
        setNewTextInput('');
    }, [newTextInput]);

    const removeCustomText = useCallback((id: string) => {
        setCustomTexts(prev => prev.filter(t => t.id !== id));
        // Remove the element from card DOM
        const card = cardPreviewRef.current;
        card?.querySelector(`[data-element="${id}"]`)?.remove();
    }, []);

    // ─── Save as image ───────────────────────────────────────────────────────
    const saveAsImage = useCallback(async () => {
        const card = cardPreviewRef.current;
        if (!card) return;
        try {
            const canvas = await html2canvas(card, { scale: 3, backgroundColor: null, logging: false });
            const link = document.createElement('a');
            link.download = 'id-card.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            notify('Kort gemt som PNG!');
        } catch (err) {
            console.error('Save as image failed:', err);
            notify('Kunne ikke gemme kortet som billede.', 'error');
        }
    }, [notify]);

    // ─── Print ───────────────────────────────────────────────────────────────
    const printCard = useCallback(async () => {
        const card = cardPreviewRef.current;
        if (!card) return;
        try {
            const canvas = await html2canvas(card, { scale: 3, backgroundColor: null, logging: false });
            const dataUrl = canvas.toDataURL('image/png');
            const win = window.open('', '_blank');
            if (!win) { notify('Kunne ikke åbne udskriftsvindue. Tjek at pop-ups er tilladt for dette site.', 'error'); return; }
            win.document.write(`<!DOCTYPE html>
<html><head><style>
  @page { size: 85.6mm 54mm; margin: 0; }
  body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; }
  img { width: 85.6mm; height: 54mm; object-fit: contain; }
</style></head><body>
  <img src="${dataUrl}" onload="window.print();window.close();" />
</body></html>`);
            win.document.close();
        } catch (err) {
            console.error('Print card failed:', err);
            notify('Udskrivning mislykkedes.', 'error');
        }
    }, [notify]);

    // ─── Save preset ─────────────────────────────────────────────────────────
    const savePreset = useCallback(() => {
        const card = cardPreviewRef.current;
        if (!card) return;
        const elementStyles: Record<string, ElementStyles> = {};
        card.querySelectorAll<HTMLElement>('.icp-element').forEach(el => {
            const id = el.dataset.element!;
            elementStyles[id] = {
                top: el.style.top, left: el.style.left,
                right: el.style.right, bottom: el.style.bottom,
                width: el.style.width, height: el.style.height,
                fontSize: el.style.fontSize,
            };
        });
        const preset: PresetData = {
            version: '1.2',
            template,
            font,
            showQrCode,
            qrContentType,
            elementStyles,
            visibility,
            customTextElements: customTexts.map(t => {
                const el = card.querySelector<HTMLElement>(`[data-element="${t.id}"]`);
                return {
                    id: t.id, content: t.content,
                    style: el ? { top: el.style.top, left: el.style.left, fontSize: el.style.fontSize } : {},
                };
            }),
        };
        const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = 'id-card-preset.json';
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        notify('Forudindstilling gemt!');
    }, [template, font, showQrCode, qrContentType, visibility, customTexts, notify]);

    // ─── Load preset ─────────────────────────────────────────────────────────
    const handlePresetFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const preset: PresetData = JSON.parse(ev.target?.result as string);
                if (preset.template)     setTemplate(preset.template);
                if (preset.font)         setFont(preset.font);
                if (typeof preset.showQrCode === 'boolean') setShowQrCode(preset.showQrCode);
                if (preset.qrContentType) setQrContentType(preset.qrContentType as 'auto' | 'custom');
                if (preset.visibility)   setVisibility(v => ({ ...v, ...preset.visibility }));

                // Restore element styles after next paint (requestAnimationFrame is more reliable than setTimeout)
                requestAnimationFrame(() => {
                    const card = cardPreviewRef.current;
                    if (!card || !preset.elementStyles) return;
                    Object.entries(preset.elementStyles).forEach(([id, styles]) => {
                        const el = card.querySelector<HTMLElement>(`[data-element="${id}"]`);
                        if (el) applyStyles(el, styles);
                    });
                });

                // Restore custom text elements
                if (preset.customTextElements) {
                    setCustomTexts([]);
                    const items = preset.customTextElements.map(item => {
                        const num = parseInt(item.id.replace('customText', '') || '0');
                        if (num > customTextCounterRef.current) customTextCounterRef.current = num;
                        return { id: item.id, content: item.content };
                    });
                    setCustomTexts(items);
                    // Two frames: first to render elements, second to apply styles
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        const card = cardPreviewRef.current;
                        if (!card) return;
                        preset.customTextElements.forEach(item => {
                            const el = card.querySelector<HTMLElement>(`[data-element="${item.id}"]`);
                            if (el && item.style) applyStyles(el, item.style);
                        });
                    }));
                }
                notify('Forudindstilling indlæst!');
            } catch (err) {
                console.error('Load preset failed:', err);
                notify('Ugyldig forudindstillingsfil.', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, [notify]);

    // ─── Visibility toggle helper ────────────────────────────────────────────
    const toggleVisibility = useCallback((key: string) => {
        setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // ─── Card template styling ───────────────────────────────────────────────
    const tpl = CARD_TEMPLATES[template] ?? CARD_TEMPLATES.minimal;
    const isMinimal = template === 'minimal';
    const cardTextColor = tpl.textColor;
    const cardPlaceholderBg = isMinimal ? '#f1f5f9' : 'rgba(255,255,255,0.25)';
    const cardPlaceholderColor = isMinimal ? '#64748b' : 'rgba(255,255,255,0.7)';
    const cardQrBg = isMinimal ? '#f1f5f9' : '#ffffff';

    // ─── Shared element style ────────────────────────────────────────────────
    const baseElementStyle = (visible: boolean): React.CSSProperties => ({
        position: 'absolute',
        cursor: dragEnabled ? 'move' : 'default',
        userSelect: 'none',
        color: cardTextColor,
        fontFamily: font,
        display: visible ? '' : 'none',
    });

    // ──────────────────────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-color, #f1f5f9)', fontFamily: 'system-ui, sans-serif' }}>

            {/* ── Notification ── */}
            {notification && (
                <div style={{
                    position: 'fixed', top: 16, right: 16, zIndex: 9999,
                    padding: '10px 20px', borderRadius: 8,
                    background: notification.type === 'success' ? '#16a34a' : '#dc2626',
                    color: '#fff', fontSize: 14, fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                    {notification.msg}
                </div>
            )}

            {/* ── Hidden file inputs ── */}
            <input ref={photoInputRef}  type="file" accept="image/*"      style={{ display: 'none' }} onChange={handlePhotoFile}  />
            <input ref={logoInputRef}   type="file" accept="image/*"      style={{ display: 'none' }} onChange={handleLogoFile}   />
            <input ref={presetInputRef} type="file" accept=".json"        style={{ display: 'none' }} onChange={handlePresetFile} />

            {/* ── Main layout ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ═══ LEFT PANEL ══════════════════════════════════════════ */}
                <aside style={{
                    width: 300, minWidth: 300, background: 'var(--card, #fff)',
                    borderRight: '1px solid var(--border, #e2e8f0)',
                    overflowY: 'auto', padding: '16px',
                    display: 'flex', flexDirection: 'column', gap: 20,
                }}>

                    {/* ── Photo ── */}
                    <section>
                        <SectionHeader icon={<Camera size={14} />} title="Foto" />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 90, height: 130, margin: '0 auto 10px',
                                border: '2px dashed var(--border, #e2e8f0)', borderRadius: 8,
                                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'var(--muted, #f8fafc)',
                            }}>
                                {photoData
                                    ? <img src={photoData} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <span style={{ fontSize: 11, color: 'var(--muted-foreground, #94a3b8)' }}>Intet foto</span>
                                }
                            </div>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <BtnSm onClick={() => photoInputRef.current?.click()}><Upload size={12} /> Upload</BtnSm>
                                <BtnSm onClick={openCamera}><Camera size={12} /> Kamera</BtnSm>
                                {photoData && <BtnSm danger onClick={() => setPhotoData(null)}><X size={12} /> Fjern</BtnSm>}
                            </div>
                        </div>
                    </section>

                    {/* ── Company ── */}
                    <section>
                        <SectionHeader title="Virksomhed" />
                        <Field label="Firmanavn">
                            <input type="text" placeholder="Acme Corporation" value={companyName} onChange={e => setCompanyName(e.target.value)} style={inputSt} />
                        </Field>
                    </section>

                    {/* ── Personal Info ── */}
                    <section>
                        <SectionHeader title="Personlige Oplysninger" />
                        <Field label="Fornavn">
                            <input type="text" placeholder="John" value={firstName} onChange={e => setFirstName(e.target.value)} style={inputSt} />
                        </Field>
                        <Field label="Efternavn">
                            <input type="text" placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} style={inputSt} />
                        </Field>
                        <Field label="ID-nummer">
                            <input type="text" placeholder="EMP-12345" value={idNumber} onChange={e => setIdNumber(e.target.value)} style={inputSt} />
                        </Field>
                        <Field label="Titel / Rolle">
                            <input type="text" placeholder="Softwareingeniør" value={title} onChange={e => setTitle(e.target.value)} style={inputSt} />
                        </Field>
                        <Field label="Afdeling">
                            <input type="text" placeholder="Engineering" value={department} onChange={e => setDepartment(e.target.value)} style={inputSt} />
                        </Field>
                        <Field label="Udløbsdato">
                            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={inputSt} />
                        </Field>
                    </section>

                    {/* ── QR Code ── */}
                    <section>
                        <SectionHeader title="QR-kode" />
                        <Field label="QR-indhold">
                            <select value={qrContentType} onChange={e => setQrContentType(e.target.value as 'auto' | 'custom')} style={inputSt}>
                                <option value="auto">Auto (fra felter)</option>
                                <option value="custom">Brugerdefineret URL/tekst</option>
                            </select>
                        </Field>
                        {qrContentType === 'custom' && (
                            <Field label="Brugerdefineret indhold">
                                <input type="text" placeholder="https://example.com" value={customQrContent} onChange={e => setCustomQrContent(e.target.value)} style={inputSt} />
                            </Field>
                        )}
                        <label style={checkLabelSt}>
                            <input type="checkbox" checked={showQrCode} onChange={e => setShowQrCode(e.target.checked)} style={{ marginRight: 6 }} />
                            Vis QR-kode på kort
                        </label>
                    </section>

                    {/* ── Design ── */}
                    <section>
                        <SectionHeader title="Design" />
                        <Field label="Skabelon">
                            <select value={template} onChange={e => setTemplate(e.target.value)} style={inputSt}>
                                {Object.entries(CARD_TEMPLATES).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Skrifttype">
                            <select value={font} onChange={e => setFont(e.target.value)} style={inputSt}>
                                {FONT_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Firmalogo">
                            <BtnFull onClick={() => logoInputRef.current?.click()}><Upload size={12} /> Upload logo</BtnFull>
                            {logoData && <BtnFull danger onClick={() => setLogoData(null)} style={{ marginTop: 4 }}><Trash2 size={12} /> Fjern logo</BtnFull>}
                        </Field>
                        <label style={checkLabelSt}>
                            <input type="checkbox" checked={dragEnabled} onChange={e => setDragEnabled(e.target.checked)} style={{ marginRight: 6 }} />
                            Flytning aktiv (træk elementer)
                        </label>
                        <label style={{ ...checkLabelSt, marginTop: 4 }}>
                            <input type="checkbox" checked={resizeEnabled} onChange={e => setResizeEnabled(e.target.checked)} style={{ marginRight: 6 }} />
                            Størrelsesændring aktiv (højreklik + træk)
                        </label>
                        <div style={{ marginTop: 8 }}>
                            <BtnFull onClick={resetLayout}><RotateCcw size={12} /> Nulstil layout</BtnFull>
                        </div>
                    </section>

                    {/* ── Visibility ── */}
                    <section>
                        <SectionHeader title="Elementsynlighed" />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                            {([
                                ['logo',        'Logo'],
                                ['companyName', 'Firmanavn'],
                                ['photo',       'Foto'],
                                ['firstName',   'Fornavn'],
                                ['lastName',    'Efternavn'],
                                ['title',       'Titel'],
                                ['department',  'Afdeling'],
                                ['id',          'ID-nummer'],
                                ['expiry',      'Udløbsdato'],
                            ] as [string, string][]).map(([key, label]) => (
                                <label key={key} style={{ ...checkLabelSt, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <input type="checkbox" checked={!!visibility[key]} onChange={() => toggleVisibility(key)} style={{ marginRight: 4 }} />
                                    {visibility[key] ? <Eye size={11} /> : <EyeOff size={11} />}
                                    <span style={{ fontSize: 12 }}>{label}</span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* ── Custom Text ── */}
                    <section>
                        <SectionHeader title="Brugerdefineret Tekst" />
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <input
                                type="text" placeholder="Indtast tekst…"
                                value={newTextInput} onChange={e => setNewTextInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addCustomText()}
                                style={{ ...inputSt, flex: 1 }}
                            />
                            <button onClick={addCustomText} style={primaryBtnSt}><Plus size={14} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {customTexts.map(t => (
                                <div key={t.id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '6px 10px', background: 'var(--muted, #f8fafc)',
                                    borderRadius: 6, border: '1px solid var(--border, #e2e8f0)',
                                }}>
                                    <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.content}>{t.content}</span>
                                    <button onClick={() => removeCustomText(t.id)} style={{ ...dangerBtnSt, marginLeft: 6, padding: '2px 6px' }}><Trash2 size={11} /></button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── Presets ── */}
                    <section>
                        <SectionHeader title="Forudindstillinger" />
                        <BtnFull onClick={savePreset} style={{ marginBottom: 6 }}><Save size={12} /> Gem forudindstilling</BtnFull>
                        <BtnFull onClick={() => presetInputRef.current?.click()}><FolderOpen size={12} /> Indlæs forudindstilling</BtnFull>
                    </section>
                </aside>

                {/* ═══ CENTER: CARD PREVIEW ═════════════════════════════════ */}
                <section style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', padding: 24,
                    background: 'var(--bg-color, #f1f5f9)', overflow: 'auto',
                }}>
                    <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted-foreground, #64748b)', fontWeight: 600 }}>
                        Kortforhåndsvisning{' '}
                        <span style={{ fontWeight: 400, fontSize: 12 }}>
                            (træk for at flytte • højreklik + træk for at ændre størrelse)
                        </span>
                    </div>

                    {/* The CR80 card */}
                    <div
                        ref={cardPreviewRef}
                        onMouseDown={handleCardMouseDown}
                        onContextMenu={handleCardContextMenu}
                        style={{
                            width: 342, height: 216, position: 'relative', overflow: 'hidden',
                            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                            background: tpl.background,
                            fontFamily: font,
                            border: isMinimal ? '1px solid #e2e8f0' : 'none',
                        }}
                    >
                        {/* Subtle overlay pattern */}
                        <div style={{
                            position: 'absolute', inset: 0, pointerEvents: 'none',
                            backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)',
                        }} />

                        {/* ── Logo ── */}
                        <div
                            className="icp-element"
                            data-element="logo"
                            style={{
                                ...baseElementStyle(visibility.logo),
                                background: cardPlaceholderBg, borderRadius: 8,
                                display: visibility.logo ? 'flex' : 'none',
                                alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden', fontSize: 10, fontWeight: 600,
                                color: cardPlaceholderColor,
                            }}
                        >
                            {logoData
                                ? <img src={logoData} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                : <span>LOGO</span>
                            }
                        </div>

                        {/* ── Company Name ── */}
                        <div className="icp-element" data-element="companyName"
                            style={{ ...baseElementStyle(visibility.companyName), fontWeight: 600, opacity: 0.9 }}>
                            {companyName || 'Firmanavn'}
                        </div>

                        {/* ── Photo ── */}
                        <div
                            className="icp-element"
                            data-element="photo"
                            style={{
                                ...baseElementStyle(visibility.photo),
                                background: cardPlaceholderBg, borderRadius: 6,
                                display: visibility.photo ? 'flex' : 'none',
                                alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden', fontSize: 10, fontWeight: 600,
                                color: cardPlaceholderColor,
                            }}
                        >
                            {photoData
                                ? <img src={photoData} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span>FOTO</span>
                            }
                        </div>

                        {/* ── First Name ── */}
                        <div className="icp-element" data-element="firstName"
                            style={{ ...baseElementStyle(visibility.firstName), fontWeight: 700 }}>
                            {firstName || 'Fornavn'}
                        </div>

                        {/* ── Last Name ── */}
                        <div className="icp-element" data-element="lastName"
                            style={{ ...baseElementStyle(visibility.lastName), fontWeight: 700 }}>
                            {lastName || 'Efternavn'}
                        </div>

                        {/* ── Title ── */}
                        <div className="icp-element" data-element="title"
                            style={{ ...baseElementStyle(visibility.title), opacity: 0.9 }}>
                            {title || 'Titel'}
                        </div>

                        {/* ── Department ── */}
                        <div className="icp-element" data-element="department"
                            style={{ ...baseElementStyle(visibility.department), opacity: 0.85 }}>
                            {department || 'Afdeling'}
                        </div>

                        {/* ── ID ── */}
                        <div className="icp-element" data-element="id"
                            style={{ ...baseElementStyle(visibility.id), fontFamily: 'monospace', opacity: 0.9 }}>
                            {idNumber ? `ID: ${idNumber}` : 'ID: ------'}
                        </div>

                        {/* ── Expiry ── */}
                        <div className="icp-element" data-element="expiry"
                            style={{ ...baseElementStyle(visibility.expiry), opacity: 0.8 }}>
                            {expiryDate
                                ? `Gyldig til: ${new Date(expiryDate).toLocaleDateString('da-DK')}`
                                : 'Gyldig til: --/--/----'}
                        </div>

                        {/* ── QR Code ── */}
                        <div
                            className="icp-element"
                            data-element="qr"
                            style={{
                                ...baseElementStyle(visibility.qr && showQrCode),
                                background: cardQrBg, borderRadius: 6, padding: 3,
                                display: visibility.qr && showQrCode ? 'flex' : 'none',
                                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                            }}
                        >
                            {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                        </div>

                        {/* ── Custom text elements ── */}
                        {customTexts.map(t => (
                            <div
                                key={t.id}
                                className="icp-element"
                                data-element={t.id}
                                style={{
                                    position: 'absolute', top: 150, left: 85,
                                    fontSize: 12, color: cardTextColor, fontFamily: font,
                                    cursor: dragEnabled ? 'move' : 'default',
                                    userSelect: 'none',
                                    padding: '2px 4px',
                                    background: 'rgba(0,0,0,0.1)', borderRadius: 2,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {t.content}
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted-foreground, #94a3b8)' }}>
                        CR80 kort: 85,6 mm × 54 mm (3,375″ × 2,125″)
                    </div>
                </section>
            </div>

            {/* ═══ BOTTOM ACTIONS ══════════════════════════════════════════ */}
            <footer style={{
                display: 'flex', justifyContent: 'center', gap: 12, padding: '12px 24px',
                background: 'var(--card, #fff)', borderTop: '1px solid var(--border, #e2e8f0)',
            }}>
                <button onClick={saveAsImage} style={secondaryBtnSt}>
                    <Download size={14} /> Gem som billede
                </button>
                <button onClick={() => setShowPrintPreview(true)} style={secondaryBtnSt}>
                    <RefreshCw size={14} /> Forhåndsvisning
                </button>
                <button onClick={printCard} style={primaryBtnSt}>
                    <Printer size={14} /> Udskriv kort
                </button>
            </footer>

            {/* ═══ CAMERA MODAL ════════════════════════════════════════════ */}
            {showCamera && (
                <Modal title="Optag foto" onClose={closeCamera}>
                    {cameraError
                        ? <p style={{ color: '#dc2626', fontSize: 13 }}>{cameraError}</p>
                        : <video ref={cameraVideoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 8, background: '#000' }} />
                    }
                    <canvas ref={cameraCanvasRef} style={{ display: 'none' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                        <button onClick={closeCamera} style={secondaryBtnSt}>Annuller</button>
                        {!cameraError && <button onClick={capturePhoto} style={primaryBtnSt}><Camera size={14} /> Tag billede</button>}
                    </div>
                </Modal>
            )}

            {/* ═══ PRINT PREVIEW MODAL ═════════════════════════════════════ */}
            {showPrintPreview && (
                <Modal title="Udskriftsforhåndsvisning" onClose={() => setShowPrintPreview(false)} wide>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 24, background: '#e0e0e0', borderRadius: 8, minHeight: 280 }}>
                        {/* Safe DOM clone — no innerHTML, no XSS */}
                        <div
                            ref={printPreviewCloneRef}
                            style={{ transform: 'scale(1.3)', transformOrigin: 'top center' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                        <button onClick={() => setShowPrintPreview(false)} style={secondaryBtnSt}>Annuller</button>
                        <button onClick={() => { setShowPrintPreview(false); printCard(); }} style={primaryBtnSt}>
                            <Printer size={14} /> Udskriv
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            {icon}
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground, #1e293b)' }}>{title}</span>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground, #64748b)', display: 'block', marginBottom: 3 }}>{label}</label>
            {children}
        </div>
    );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div style={{
                background: 'var(--card, #fff)', borderRadius: 12,
                width: wide ? '80vw' : '480px', maxWidth: '95vw',
                maxHeight: '90vh', overflow: 'auto',
                boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            }}>
                <div style={{
                    padding: '14px 20px', borderBottom: '1px solid var(--border, #e2e8f0)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted-foreground, #64748b)' }}>✕</button>
                </div>
                <div style={{ padding: 20 }}>{children}</div>
            </div>
        </div>
    );
}

function BtnSm({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
    return (
        <button onClick={onClick} style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${danger ? '#fca5a5' : 'var(--border, #e2e8f0)'}`,
            background: danger ? 'transparent' : 'var(--muted, #f8fafc)',
            color: danger ? '#dc2626' : 'var(--foreground, #1e293b)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
            {children}
        </button>
    );
}

function BtnFull({ onClick, danger, children, style }: { onClick: () => void; danger?: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <button onClick={onClick} style={{
            width: '100%', padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${danger ? '#fca5a5' : 'var(--border, #e2e8f0)'}`,
            background: danger ? 'transparent' : 'var(--muted, #f8fafc)',
            color: danger ? '#dc2626' : 'var(--foreground, #1e293b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            ...style,
        }}>
            {children}
        </button>
    );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
    width: '100%', padding: '6px 10px', fontSize: 13,
    border: '1px solid var(--border, #e2e8f0)', borderRadius: 6,
    background: 'var(--background, #fff)', color: 'var(--foreground, #1e293b)',
    boxSizing: 'border-box',
};

const checkLabelSt: React.CSSProperties = {
    fontSize: 12, display: 'flex', alignItems: 'center', cursor: 'pointer',
    color: 'var(--foreground, #1e293b)',
};

const primaryBtnSt: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: 'var(--primary, #6366f1)', color: '#fff', fontSize: 13, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 6,
};

const secondaryBtnSt: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
    border: '1px solid var(--border, #e2e8f0)',
    background: 'var(--muted, #f8fafc)', color: 'var(--foreground, #1e293b)',
    fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
};

const dangerBtnSt: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 5, cursor: 'pointer',
    border: '1px solid #fca5a5', background: 'transparent',
    color: '#dc2626', fontSize: 12, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 3,
};
