import { useState, useRef, useCallback } from 'react';

interface DetectedRegion {
    label: string;
    confidence: number;
    bbox: { x: number; y: number; w: number; h: number };
}

interface ImageRedactionPreviewProps {
    /** Base64-encoded redacted image from the server */
    redactedImageBase64: string;
    /** Detection metadata from the analyse-image endpoint */
    detections: DetectedRegion[];
    /** Image dimensions */
    width: number;
    height: number;
    /** Called when user confirms the upload */
    onConfirm: (detections: DetectedRegion[]) => void;
    /** Called when user cancels */
    onCancel: () => void;
}

/**
 * Preview component showing detected sensitive regions on an image.
 * Users can add/remove blur regions before confirming upload.
 */
export function ImageRedactionPreview({
    redactedImageBase64,
    detections: initialDetections,
    width,
    height,
    onConfirm,
    onCancel,
}: ImageRedactionPreviewProps) {
    const [detections, setDetections] = useState<DetectedRegion[]>(initialDetections);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const scale = Math.min(600 / width, 400 / height, 1);
    const displayWidth = width * scale;
    const displayHeight = height * scale;

    const removeDetection = useCallback((index: number) => {
        setDetections(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setIsDrawing(true);
        setDrawStart({
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale,
        });
    }, [scale]);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        if (!isDrawing || !drawStart || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const endX = (e.clientX - rect.left) / scale;
        const endY = (e.clientY - rect.top) / scale;

        const w = Math.abs(endX - drawStart.x);
        const h = Math.abs(endY - drawStart.y);

        // Only add if the region is at least 10px
        if (w > 10 && h > 10) {
            setDetections(prev => [...prev, {
                label: 'manual',
                confidence: 1.0,
                bbox: {
                    x: Math.min(drawStart.x, endX),
                    y: Math.min(drawStart.y, endY),
                    w,
                    h,
                },
            }]);
        }

        setIsDrawing(false);
        setDrawStart(null);
    }, [isDrawing, drawStart, scale]);

    return (
        <div style={{
            padding: 20, background: 'var(--card, #fff)',
            border: '1px solid var(--border, #e5e7eb)', borderRadius: 12,
        }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>
                🛡️ Billedredaktion — Gennemse følsomme områder
            </h3>

            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 12 }}>
                {detections.length} område(r) fundet.
                Klik og træk for at tilføje nye områder. Klik ✕ for at fjerne.
            </div>

            {/* Image with overlay regions */}
            <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                style={{
                    position: 'relative', display: 'inline-block',
                    width: displayWidth, height: displayHeight,
                    cursor: 'crosshair', userSelect: 'none',
                    border: '1px solid var(--border, #d1d5db)', borderRadius: 8, overflow: 'hidden',
                }}
            >
                <img
                    src={`data:image/png;base64,${redactedImageBase64}`}
                    alt="Redacted preview"
                    style={{ width: displayWidth, height: displayHeight, display: 'block' }}
                />
                {detections.map((det, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: det.bbox.x * scale,
                            top: det.bbox.y * scale,
                            width: det.bbox.w * scale,
                            height: det.bbox.h * scale,
                            border: det.label === 'manual' ? '2px dashed #f59e0b' : '2px solid #ef4444',
                            borderRadius: 4,
                            background: 'rgba(239, 68, 68, 0.1)',
                        }}
                    >
                        <button
                            onClick={(e) => { e.stopPropagation(); removeDetection(i); }}
                            style={{
                                position: 'absolute', top: -8, right: -8,
                                width: 16, height: 16, borderRadius: '50%',
                                border: 'none', background: '#ef4444', color: '#fff',
                                fontSize: 10, cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                lineHeight: 1,
                            }}
                        >
                            ✕
                        </button>
                        <span style={{
                            position: 'absolute', bottom: 2, left: 4,
                            fontSize: 9, color: '#ef4444', fontWeight: 600,
                        }}>
                            {det.label} ({(det.confidence * 100).toFixed(0)}%)
                        </span>
                    </div>
                ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                    onClick={() => onConfirm(detections)}
                    style={{
                        padding: '8px 20px', borderRadius: 6,
                        border: 'none', background: 'var(--primary, #3b82f6)', color: '#fff',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}
                >
                    ✅ Bekræft og upload
                </button>
                <button
                    onClick={onCancel}
                    style={{
                        padding: '8px 20px', borderRadius: 6,
                        border: '1px solid var(--border, #d1d5db)', background: 'transparent',
                        fontSize: 12, cursor: 'pointer', color: 'var(--foreground)',
                    }}
                >
                    Annuller
                </button>
            </div>
        </div>
    );
}
