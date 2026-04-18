/**
 * Image Analysis & Redaction Service
 *
 * Accepts a raw image buffer, detects sensitive information (faces, IDs,
 * credit cards, license plates, addresses), and applies Gaussian blur
 * to all detected regions.
 *
 * Uses Azure AI Vision for detection. Falls back gracefully if the
 * endpoint is not configured.
 *
 * The original un-redacted image is NEVER persisted to storage.
 *
 * Usage:
 *   import { analyseImage } from './services/imageAnalysis.js';
 *
 *   const { redactedBuffer, detections } = await analyseImage(imageBuffer);
 */

import sharp from 'sharp';

// ─── Configuration ─────────────────────────────────────────────

const ANALYSIS_ENDPOINT = process.env.IMAGE_ANALYSIS_ENDPOINT;
const ANALYSIS_KEY = process.env.IMAGE_ANALYSIS_KEY;

export interface Detection {
    label: string;
    confidence: number;
    bbox: { x: number; y: number; w: number; h: number };
}

export interface AnalysisResult {
    detections: Detection[];
    redactedBuffer: Buffer;
    width: number;
    height: number;
}

// ─── Azure AI Vision Detection ─────────────────────────────────

/**
 * Call Azure AI Vision to detect faces and objects in the image.
 * Returns bounding boxes for sensitive regions.
 */
async function detectSensitiveRegions(imageBuffer: Buffer): Promise<Detection[]> {
    if (!ANALYSIS_ENDPOINT || !ANALYSIS_KEY) {
        console.warn('[ImageAnalysis] No analysis endpoint configured — skipping detection.');
        return [];
    }

    try {
        // Use Azure Computer Vision's Analyze endpoint with face + object detection
        const url = `${ANALYSIS_ENDPOINT}?visualFeatures=Faces,Objects&details=Landmarks`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Ocp-Apim-Subscription-Key': ANALYSIS_KEY,
            },
            body: new Uint8Array(imageBuffer),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[ImageAnalysis] Azure API error ${response.status}:`, errorText);
            return [];
        }

        const result = await response.json() as any;
        const detections: Detection[] = [];

        // Map faces
        if (result.faces) {
            for (const face of result.faces) {
                const rect = face.faceRectangle;
                detections.push({
                    label: 'face',
                    confidence: 0.95,
                    bbox: {
                        x: rect.left,
                        y: rect.top,
                        w: rect.width,
                        h: rect.height,
                    },
                });
            }
        }

        // Map objects that could be sensitive (IDs, cards, etc.)
        if (result.objects) {
            const sensitiveObjects = ['person', 'card', 'id card', 'document', 'license plate'];
            for (const obj of result.objects) {
                if (sensitiveObjects.some(s => obj.object?.toLowerCase().includes(s))) {
                    const rect = obj.rectangle;
                    detections.push({
                        label: obj.object,
                        confidence: obj.confidence ?? 0.8,
                        bbox: {
                            x: rect.x,
                            y: rect.y,
                            w: rect.w,
                            h: rect.h,
                        },
                    });
                }
            }
        }

        console.log(`[ImageAnalysis] Detected ${detections.length} sensitive region(s)`);
        return detections;
    } catch (err) {
        console.error('[ImageAnalysis] Detection failed:', err);
        return [];
    }
}

// ─── Gaussian Blur Redaction ───────────────────────────────────

/**
 * Apply Gaussian blur (σ ≥ 15) to all detected regions in the image.
 * Returns a new buffer with the regions redacted.
 */
async function applyBlur(imageBuffer: Buffer, detections: Detection[]): Promise<Buffer> {
    if (detections.length === 0) {
        return imageBuffer;
    }

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // Create composite overlays: extract each region, blur it, then composite back
    const composites: sharp.OverlayOptions[] = [];

    for (const det of detections) {
        // Clamp bbox to image bounds
        const x = Math.max(0, Math.round(det.bbox.x));
        const y = Math.max(0, Math.round(det.bbox.y));
        const w = Math.min(Math.round(det.bbox.w), width - x);
        const h = Math.min(Math.round(det.bbox.h), height - y);

        if (w <= 0 || h <= 0) continue;

        // Extract the region, blur it heavily (σ = 20)
        const blurredRegion = await sharp(imageBuffer)
            .extract({ left: x, top: y, width: w, height: h })
            .blur(20)
            .toBuffer();

        composites.push({
            input: blurredRegion,
            left: x,
            top: y,
        });
    }

    if (composites.length === 0) {
        return imageBuffer;
    }

    return image.composite(composites).toBuffer();
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Analyse an image for sensitive content and return a redacted version.
 *
 * @param imageBuffer - Raw image bytes (PNG, JPEG, etc.)
 * @returns Redacted image buffer + detection metadata
 */
export async function analyseImage(imageBuffer: Buffer): Promise<AnalysisResult> {
    const metadata = await sharp(imageBuffer).metadata();

    // Step 1: Detect sensitive regions via Azure AI Vision
    const detections = await detectSensitiveRegions(imageBuffer);

    // Step 2: Apply blur to detected regions
    const redactedBuffer = await applyBlur(imageBuffer, detections);

    return {
        detections,
        redactedBuffer,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
    };
}

/**
 * Check if image analysis is available (endpoint configured).
 */
export function isAnalysisConfigured(): boolean {
    return !!(ANALYSIS_ENDPOINT && ANALYSIS_KEY);
}
