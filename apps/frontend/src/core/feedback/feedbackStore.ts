import { create } from 'zustand';
import { api, BASE_URL } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────

export type FeedbackSessionStatus = 'active' | 'paused' | 'completed';

export interface FeedbackAnnotation {
    id: string;
    type: 'arrow' | 'text' | 'highlight' | 'circle' | 'rectangle' | 'blur';
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    color: string;
    timestamp: string;
    endX?: number;
    endY?: number;
}

export interface FeedbackScreenshot {
    id: string;
    url: string;
    annotations: FeedbackAnnotation[];
    timestamp: string;
    comment?: string;
    /** Server blob path */
    blobPath: string;
}

export interface FeedbackNavigationEntry {
    id: string;
    url: string;
    title: string;
    timestamp: string;
    duration?: number;
    /** Server field name */
    createdAt?: string;
}

export interface FeedbackVoiceRecording {
    id: string;
    duration: number;
    timestamp: string;
    comment?: string;
    blobPath: string;
}

export interface FeedbackVideoRecording {
    id: string;
    duration: number;
    timestamp: string;
    comment?: string;
    blobPath: string;
}

export interface FeedbackChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt?: string;
}

export interface FeedbackChatTranscript {
    id: string;
    conversationId: string;
    conversationTitle: string | null;
    model: string;
    messages: FeedbackChatMessage[];
    messageCount: number;
    timestamp: string;
    url: string;
    /** Server field name */
    createdAt?: string;
}

// Server shape → client shape adapter
interface ServerSession {
    id: string;
    title: string;
    description?: string;
    status: FeedbackSessionStatus;
    startUrl: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string | null;
    navigationEntries: ServerNavEntry[];
    screenshots: ServerScreenshot[];
    recordings: ServerRecording[];
    chatTranscripts: ServerChatTranscript[];
    user?: { id: string; name?: string; email?: string; displayName?: string; avatarUrl?: string };
}

interface ServerNavEntry {
    id: string;
    url: string;
    title: string;
    duration: number | null;
    createdAt: string;
}

interface ServerScreenshot {
    id: string;
    url: string;
    blobPath: string;
    comment: string | null;
    createdAt: string;
}

interface ServerRecording {
    id: string;
    type: 'voice' | 'video';
    blobPath: string;
    duration: number;
    comment: string | null;
    createdAt: string;
}

interface ServerChatTranscript {
    id: string;
    conversationId: string;
    conversationTitle: string | null;
    model: string;
    messages: FeedbackChatMessage[];
    messageCount: number;
    url: string;
    createdAt: string;
}

export interface FeedbackSession {
    id: string;
    title: string;
    description?: string;
    status: FeedbackSessionStatus;
    startUrl: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    navigationHistory: FeedbackNavigationEntry[];
    screenshots: FeedbackScreenshot[];
    voiceRecordings: FeedbackVoiceRecording[];
    videoRecordings: FeedbackVideoRecording[];
    chatTranscripts: FeedbackChatTranscript[];
    user?: { id: string; name?: string; email?: string; displayName?: string; avatarUrl?: string };
}

// ─── Server → Client shape adapter ───────────────────────────

function toClientSession(s: ServerSession): FeedbackSession {
    return {
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status,
        startUrl: s.startUrl,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        completedAt: s.completedAt ?? undefined,
        user: s.user,
        navigationHistory: (s.navigationEntries ?? []).map(n => ({
            id: n.id,
            url: n.url,
            title: n.title,
            timestamp: n.createdAt,
            duration: n.duration ?? undefined,
        })),
        screenshots: (s.screenshots ?? []).map(ss => ({
            id: ss.id,
            url: ss.url,
            annotations: [],
            timestamp: ss.createdAt,
            comment: ss.comment ?? undefined,
            blobPath: ss.blobPath,
        })),
        voiceRecordings: (s.recordings ?? []).filter(r => r.type === 'voice').map(r => ({
            id: r.id,
            duration: r.duration,
            timestamp: r.createdAt,
            comment: r.comment ?? undefined,
            blobPath: r.blobPath,
        })),
        videoRecordings: (s.recordings ?? []).filter(r => r.type === 'video').map(r => ({
            id: r.id,
            duration: r.duration,
            timestamp: r.createdAt,
            comment: r.comment ?? undefined,
            blobPath: r.blobPath,
        })),
        chatTranscripts: (s.chatTranscripts ?? []).map(ct => ({
            id: ct.id,
            conversationId: ct.conversationId,
            conversationTitle: ct.conversationTitle,
            model: ct.model,
            messages: ct.messages,
            messageCount: ct.messageCount,
            timestamp: ct.createdAt,
            url: ct.url,
        })),
    };
}

// ─── API helpers ─────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    const token = api.getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    const tenantId = api.getTenantId();
    if (tenantId) h['X-Tenant-Id'] = tenantId;
    return h;
}

export async function getAllSessions(): Promise<FeedbackSession[]> {
    const data = await api.get<ServerSession[]>('/feedback/sessions');
    return data.map(toClientSession);
}

export async function getSession(id: string): Promise<FeedbackSession | undefined> {
    try {
        const data = await api.get<ServerSession>(`/feedback/sessions/${id}`);
        return toClientSession(data);
    } catch {
        return undefined;
    }
}

export async function getScreenshotBlob(screenshotId: string): Promise<Blob | undefined> {
    // We need the blobPath for this screenshot,
    // but the component already has url (blob path).
    // So we provide a helper that fetches by blob path.
    return undefined; // Will be replaced by getScreenshotBlobByPath
}

export async function getScreenshotBlobByPath(blobPath: string): Promise<Blob | undefined> {
    try {
        // Strip 'feedback/' prefix since the API endpoint adds it
        const key = blobPath.replace(/^feedback\//, '');
        const res = await fetch(`${BASE_URL}/feedback/blobs/${key}`, {
            headers: getAuthHeaders(),
            credentials: 'include' as const,
        });
        if (!res.ok) return undefined;
        return await res.blob();
    } catch {
        return undefined;
    }
}

export async function getVoiceBlob(recordingId: string): Promise<Blob | undefined> {
    return undefined; // Will be replaced by getRecordingBlobByPath
}

export async function getVideoBlob(recordingId: string): Promise<Blob | undefined> {
    return undefined; // Will be replaced by getRecordingBlobByPath
}

export async function getRecordingBlobByPath(blobPath: string): Promise<Blob | undefined> {
    try {
        const key = blobPath.replace(/^feedback\//, '');
        const res = await fetch(`${BASE_URL}/feedback/blobs/${key}`, {
            headers: getAuthHeaders(),
            credentials: 'include' as const,
        });
        if (!res.ok) return undefined;
        return await res.blob();
    } catch {
        return undefined;
    }
}

// ─── Store ───────────────────────────────────────────────────

interface FeedbackState {
    activeSession: FeedbackSession | null;
    isCapturing: boolean;
    isRecordingVoice: boolean;
    isRecordingVideo: boolean;
    countdown: number | null;
    _lastScreenshotTs: number; // timestamp of last successful screenshot capture (for flash feedback)

    // Session lifecycle
    startSession: (title: string, description?: string) => Promise<void>;
    startSessionFromChat: (opts: {
        conversationId: string;
        conversationTitle: string | null;
        model: string;
        messages: FeedbackChatMessage[];
        url: string;
    }) => Promise<FeedbackSession>;
    addChatTranscript: (transcript: Omit<FeedbackChatTranscript, 'id' | 'timestamp'>) => Promise<void>;
    pauseSession: () => Promise<void>;
    resumeSession: () => Promise<void>;
    resumeSessionById: (sessionId: string) => Promise<void>;
    completeSession: () => Promise<string | null>;

    // Screenshots
    captureScreenshot: () => Promise<void>;

    // Voice
    startVoiceRecording: () => Promise<void>;
    stopVoiceRecording: () => Promise<void>;

    // Video
    startVideoRecording: () => Promise<void>;
    stopVideoRecording: () => Promise<void>;

    // Navigation tracking
    trackNavigation: (url: string, title: string) => void;

    // Internal refs (not serialised)
    _voiceRecorder: MediaRecorder | null;
    _voiceChunks: Blob[];
    _voiceStart: number;
    _videoRecorder: MediaRecorder | null;
    _videoChunks: Blob[];
    _videoStart: number;
    _lastTrackedUrl: string;
    _lastNavTs: number;
    _countdownTimer: ReturnType<typeof setInterval> | null;
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
    activeSession: null,
    isCapturing: false,
    isRecordingVoice: false,
    isRecordingVideo: false,
    countdown: null,
    _lastScreenshotTs: 0,

    _voiceRecorder: null,
    _voiceChunks: [],
    _voiceStart: 0,
    _videoRecorder: null,
    _videoChunks: [],
    _videoStart: 0,
    _lastTrackedUrl: '',
    _lastNavTs: 0,
    _countdownTimer: null,

    // ── Session lifecycle ─────────────────────────────────────────

    startSession: async (title, description) => {
        const url = window.location.href;
        try {
            const serverSession = await api.post<ServerSession>('/feedback/sessions', {
                title,
                description,
                startUrl: url,
            });

            // Add initial navigation entry
            await api.post(`/feedback/sessions/${serverSession.id}/navigation`, {
                url,
                title: document.title || url,
            });

            // Re-fetch to get the full session with children
            const freshData = await api.get<ServerSession>(`/feedback/sessions/${serverSession.id}`);
            const session = toClientSession(freshData);
            set({ activeSession: session, _lastTrackedUrl: url, _lastNavTs: Date.now() });
        } catch (err) {
            console.error('[Feedback] Failed to start session:', err);
        }
    },

    startSessionFromChat: async ({ conversationId, conversationTitle, model, messages, url }) => {
        const title = conversationTitle
            ? `Feedback: ${conversationTitle}`
            : `Chat Feedback ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

        const serverSession = await api.post<ServerSession>('/feedback/sessions', {
            title,
            description: `Chat session med ${messages.length} beskeder (${model})`,
            startUrl: url,
        });

        // Add initial navigation
        await api.post(`/feedback/sessions/${serverSession.id}/navigation`, {
            url,
            title: document.title || url,
        });

        // Add chat transcript
        await api.post(`/feedback/sessions/${serverSession.id}/chats`, {
            conversationId,
            conversationTitle,
            model,
            messages,
            messageCount: messages.length,
            url,
        });

        // Re-fetch full session
        const freshData = await api.get<ServerSession>(`/feedback/sessions/${serverSession.id}`);
        const session = toClientSession(freshData);
        set({ activeSession: session, _lastTrackedUrl: url, _lastNavTs: Date.now() });
        return session;
    },

    addChatTranscript: async (transcriptData) => {
        const s = get().activeSession;
        if (!s || s.status !== 'active') return;

        try {
            await api.post(`/feedback/sessions/${s.id}/chats`, {
                conversationId: transcriptData.conversationId,
                conversationTitle: transcriptData.conversationTitle,
                model: transcriptData.model,
                messages: transcriptData.messages,
                messageCount: transcriptData.messageCount,
                url: transcriptData.url,
            });

            // Refresh
            const freshData = await api.get<ServerSession>(`/feedback/sessions/${s.id}`);
            set({ activeSession: toClientSession(freshData) });
        } catch (err) {
            console.error('[Feedback] Failed to add chat transcript:', err);
        }
    },

    pauseSession: async () => {
        const s = get().activeSession;
        if (!s) return;
        try {
            const data = await api.post<ServerSession>(`/feedback/sessions/${s.id}`, { status: 'paused' });
            // Use PATCH via raw fetch since api client may not have patch
            const res = await fetch(`${BASE_URL}/feedback/sessions/${s.id}`, {
                method: 'PATCH',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'paused' }),
                credentials: 'include' as const,
            });
            if (res.ok) {
                const freshData = await api.get<ServerSession>(`/feedback/sessions/${s.id}`);
                set({ activeSession: toClientSession(freshData) });
            }
        } catch (err) {
            console.error('[Feedback] Failed to pause session:', err);
        }
    },

    resumeSession: async () => {
        const s = get().activeSession;
        if (!s) return;
        try {
            const res = await fetch(`${BASE_URL}/feedback/sessions/${s.id}`, {
                method: 'PATCH',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'active' }),
                credentials: 'include' as const,
            });
            if (res.ok) {
                const freshData = await api.get<ServerSession>(`/feedback/sessions/${s.id}`);
                set({ activeSession: toClientSession(freshData) });
            }
        } catch (err) {
            console.error('[Feedback] Failed to resume session:', err);
        }
    },

    resumeSessionById: async (sessionId: string) => {
        const current = get().activeSession;
        if (current) {
            console.warn('[Feedback] Cannot resume – another session is already active:', current.id);
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/feedback/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'active' }),
                credentials: 'include' as const,
            });

            if (res.ok) {
                const url = window.location.href;

                // Add navigation entry for current page
                await api.post(`/feedback/sessions/${sessionId}/navigation`, {
                    url,
                    title: document.title || url,
                });

                const freshData = await api.get<ServerSession>(`/feedback/sessions/${sessionId}`);
                set({ activeSession: toClientSession(freshData), _lastTrackedUrl: url, _lastNavTs: Date.now() });
                console.log('[Feedback] Session resumed:', sessionId);
            }
        } catch (err) {
            console.error('[Feedback] Failed to resume session:', err);
        }
    },

    completeSession: async () => {
        const s = get().activeSession;
        if (!s) return null;

        // Stop any active recordings before completing
        if (get().isRecordingVoice && get()._voiceRecorder) {
            try { await get().stopVoiceRecording(); } catch (e) { console.error('Error stopping voice:', e); }
        }
        if (get().isRecordingVideo && get()._videoRecorder) {
            try { await get().stopVideoRecording(); } catch (e) { console.error('Error stopping video:', e); }
        }

        const freshSession = get().activeSession;
        if (!freshSession) return null;

        const sessionId = freshSession.id;

        try {
            await fetch(`${BASE_URL}/feedback/sessions/${freshSession.id}`, {
                method: 'PATCH',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' }),
                credentials: 'include' as const,
            });
            set({ activeSession: null, _lastTrackedUrl: '', _lastNavTs: 0 });
            return sessionId;
        } catch (err) {
            console.error('[Feedback] Failed to complete session:', err);
            return null;
        }
    },

    // ── Screenshot capture ────────────────────────────────────────

    captureScreenshot: async () => {
        const s = get().activeSession;
        if (!s || s.status !== 'active') return;

        // Countdown 3…2…1
        set({ countdown: 3 });
        const timer = get()._countdownTimer;
        if (timer) clearInterval(timer);

        await new Promise<void>((resolve) => {
            const iv = setInterval(() => {
                const c = get().countdown;
                if (c === null || c <= 1) {
                    clearInterval(iv);
                    set({ countdown: null, _countdownTimer: null });
                    resolve();
                } else {
                    set({ countdown: c - 1 });
                }
            }, 1000);
            set({ _countdownTimer: iv });
        });

        const freshSession = get().activeSession;
        if (!freshSession || freshSession.status !== 'active') {
            console.warn('[Feedback] Session ended during countdown, aborting screenshot');
            return;
        }

        set({ isCapturing: true });

        try {
            console.log('[Feedback] Importing html2canvas-pro...');
            const html2canvasModule = await import('html2canvas-pro');
            const html2canvas = html2canvasModule.default;
            const canvas = await html2canvas(document.body, {
                allowTaint: true,
                useCORS: true,
                logging: false,
            });

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b: Blob | null) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
            });

            // Upload to server via multipart
            const formData = new FormData();
            formData.append('url', window.location.href);
            formData.append('file', blob, `screenshot-${Date.now()}.png`);

            const res = await fetch(`${BASE_URL}/feedback/sessions/${freshSession.id}/screenshots`, {
                method: 'POST',
                headers: getAuthHeaders(), // Don't set Content-Type — FormData handles it
                body: formData,
                credentials: 'include' as const,
            });

            if (res.ok) {
                // Refresh session
                const freshData = await api.get<ServerSession>(`/feedback/sessions/${freshSession.id}`);
                set({ activeSession: toClientSession(freshData), _lastScreenshotTs: Date.now() });
                console.log('[Feedback] Screenshot uploaded and saved!');
            } else {
                console.error('[Feedback] Screenshot upload failed:', res.status);
            }
        } catch (err) {
            console.error('[Feedback] Screenshot capture failed:', err);
        } finally {
            set({ isCapturing: false });
        }
    },

    // ── Voice recording ───────────────────────────────────────────

    startVoiceRecording: async () => {
        const s = get().activeSession;
        if (!s || s.status !== 'active' || get().isRecordingVoice) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const chunks: Blob[] = [];
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
            const recorder = new MediaRecorder(stream, { mimeType });
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.start();
            set({ _voiceRecorder: recorder, _voiceChunks: chunks, _voiceStart: Date.now(), isRecordingVoice: true });
        } catch (err) {
            console.error('[Feedback] Failed to start voice recording:', err);
        }
    },

    stopVoiceRecording: async () => {
        const { _voiceRecorder: recorder, _voiceChunks: chunks, _voiceStart: start } = get();
        if (!recorder) return;

        await new Promise<void>((resolve) => {
            recorder.onstop = async () => {
                try {
                    const duration = (Date.now() - start) / 1000;
                    const blob = new Blob(chunks, { type: recorder.mimeType });
                    recorder.stream.getTracks().forEach((t) => t.stop());

                    const freshSession = get().activeSession;
                    if (freshSession) {
                        // Upload to server
                        const formData = new FormData();
                        formData.append('type', 'voice');
                        formData.append('duration', String(duration));
                        formData.append('file', blob, `voice-${Date.now()}.webm`);

                        await fetch(`${BASE_URL}/feedback/sessions/${freshSession.id}/recordings`, {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: formData,
                            credentials: 'include' as const,
                        });

                        // Refresh
                        const freshData = await api.get<ServerSession>(`/feedback/sessions/${freshSession.id}`);
                        set({ activeSession: toClientSession(freshData) });
                        console.log('[Feedback] Voice recording uploaded!');
                    }
                } catch (err) {
                    console.error('[Feedback] Voice recording save failed:', err);
                } finally {
                    set({ _voiceRecorder: null, _voiceChunks: [], isRecordingVoice: false });
                    resolve();
                }
            };
            recorder.stop();
        });
    },

    // ── Video recording ───────────────────────────────────────────

    startVideoRecording: async () => {
        const s = get().activeSession;
        if (!s || s.status !== 'active' || get().isRecordingVideo) return;

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' } as MediaTrackConstraints,
                audio: true,
            });

            const chunks: Blob[] = [];
            const mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
            const recorder = new MediaRecorder(stream, { mimeType });
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.onended = () => {
                    if (recorder.state === 'recording') get().stopVideoRecording();
                };
            }

            recorder.start();
            set({ _videoRecorder: recorder, _videoChunks: chunks, _videoStart: Date.now(), isRecordingVideo: true });
        } catch (err) {
            console.error('[Feedback] Failed to start video recording:', err);
        }
    },

    stopVideoRecording: async () => {
        const { _videoRecorder: recorder, _videoChunks: chunks, _videoStart: start } = get();
        if (!recorder) return;

        await new Promise<void>((resolve) => {
            recorder.onstop = async () => {
                try {
                    const duration = (Date.now() - start) / 1000;
                    const blob = new Blob(chunks, { type: recorder.mimeType });
                    recorder.stream.getTracks().forEach((t) => t.stop());

                    const freshSession = get().activeSession;
                    if (freshSession) {
                        const formData = new FormData();
                        formData.append('type', 'video');
                        formData.append('duration', String(duration));
                        formData.append('file', blob, `video-${Date.now()}.webm`);

                        await fetch(`${BASE_URL}/feedback/sessions/${freshSession.id}/recordings`, {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: formData,
                            credentials: 'include' as const,
                        });

                        const freshData = await api.get<ServerSession>(`/feedback/sessions/${freshSession.id}`);
                        set({ activeSession: toClientSession(freshData) });
                        console.log('[Feedback] Video recording uploaded!');
                    }
                } catch (err) {
                    console.error('[Feedback] Video recording save failed:', err);
                } finally {
                    set({ _videoRecorder: null, _videoChunks: [], isRecordingVideo: false });
                    resolve();
                }
            };
            recorder.stop();
        });
    },

    // ── Navigation tracking ───────────────────────────────────────

    trackNavigation: (url, title) => {
        const s = get().activeSession;
        if (!s || s.status !== 'active') return;
        if (url === get()._lastTrackedUrl) return;

        const now = Date.now();
        const prevTs = get()._lastNavTs;
        const duration = prevTs > 0 ? (now - prevTs) / 1000 : undefined;

        set({ _lastTrackedUrl: url, _lastNavTs: now });

        // Fire-and-forget API call
        api.post(`/feedback/sessions/${s.id}/navigation`, {
            url,
            title,
            duration,
        }).catch(err => console.error('[Feedback] Failed to track navigation:', err));
    },
}));
