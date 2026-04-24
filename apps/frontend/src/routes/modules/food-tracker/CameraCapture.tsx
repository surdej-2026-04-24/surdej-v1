import { useEffect, useRef, useCallback } from 'react';
import { Camera, X } from 'lucide-react';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false,
                });
                if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                if (!mounted) return;
                console.error('Camera access failed:', err);
                onClose();
            }
        })();

        return () => {
            mounted = false;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };
    }, [onClose]);

    const handleCapture = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        canvas.toBlob(blob => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            if (!blob) return;
            onCapture(new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
    }, [onCapture]);

    const handleClose = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        onClose();
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Kamera"
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: '#000',
                display: 'flex', flexDirection: 'column',
            }}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ flex: 1, width: '100%', objectFit: 'cover' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{
                padding: '24px 24px max(40px, env(safe-area-inset-bottom))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32,
                background: 'rgba(0,0,0,0.75)',
                flexShrink: 0,
            }}>
                <button
                    onClick={handleClose}
                    aria-label="Annuller"
                    style={{
                        background: 'rgba(255,255,255,0.15)',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderRadius: '50%', width: 52, height: 52,
                        cursor: 'pointer', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <X size={22} />
                </button>
                <button
                    onClick={handleCapture}
                    aria-label="Tag billede"
                    style={{
                        background: '#fff',
                        border: '5px solid rgba(255,255,255,0.4)',
                        borderRadius: '50%', width: 76, height: 76,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 0 3px rgba(255,255,255,0.15)',
                    }}
                >
                    <Camera size={30} color="#111" />
                </button>
            </div>
        </div>
    );
}
