/**
 * Core Issues — New Issue page
 * Supports pre-filling from query params (?title=...&feedbackSessionId=...)
 *
 * When linked from a feedback session:
 *   1. Auto-uploads all screenshots, audio, video to blob store
 *   2. Embeds screenshots as base64 images in the issue description
 *   3. Builds a story from navigation history (visited URLs)
 *   4. Transcribes voice recordings via AI (Whisper) and uses the
 *      transcription to formulate the issue description
 *   5. Uploads videos to blob store and links to them
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { IssueForm } from '@surdej/module-core-issues-ui';
import {
    getSession,
    getScreenshotBlobByPath,
    getRecordingBlobByPath,
    type FeedbackSession,
} from '@/core/feedback/feedbackStore';

interface UploadedAttachment {
    id: string;
    filename: string;
    type: 'screenshot' | 'audio' | 'video';
    blobId?: string;
    base64?: string;        // base64 data URL for screenshots
    transcription?: string; // transcribed text for audio
    uploaded: boolean;
    error?: string;
}

type ProcessingStep = 'idle' | 'uploading' | 'transcribing' | 'generating' | 'done';

export function NewIssuePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const prefillTitle = searchParams.get('title') ?? undefined;
    const feedbackSessionId = searchParams.get('feedbackSessionId');

    const [session, setSession] = useState<FeedbackSession | null>(null);
    const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
    const [step, setStep] = useState<ProcessingStep>('idle');
    const [generatedDescription, setGeneratedDescription] = useState<string | undefined>();
    const [generatedTitle, setGeneratedTitle] = useState<string | undefined>();
    const processedRef = useRef(false);

    // Load feedback session data
    useEffect(() => {
        if (!feedbackSessionId) return;
        getSession(feedbackSessionId).then(s => {
            if (s) setSession(s);
        });
    }, [feedbackSessionId]);

    // Build attachment list from session
    useEffect(() => {
        if (!session) return;
        const items: UploadedAttachment[] = [];

        session.screenshots.forEach((ss, i) => {
            items.push({
                id: ss.id,
                filename: `screenshot-${i + 1}.png`,
                type: 'screenshot',
                uploaded: false,
            });
        });

        session.voiceRecordings.forEach((rec, i) => {
            items.push({
                id: rec.id,
                filename: `audio-${i + 1}.webm`,
                type: 'audio',
                uploaded: false,
            });
        });

        session.videoRecordings.forEach((rec, i) => {
            items.push({
                id: rec.id,
                filename: `video-${i + 1}.webm`,
                type: 'video',
                uploaded: false,
            });
        });

        setAttachments(items);
    }, [session]);

    // ── Helpers ────────────────────────────────────────────────────

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const transcribeAudio = async (blob: Blob, filename: string): Promise<string> => {
        const formData = new FormData();
        formData.append('file', blob, filename);

        const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });

        if (!res.ok) {
            console.warn('[Transcribe] Failed:', res.status);
            return '(Transskription fejlede)';
        }

        const data = await res.json();
        return data.text || '(Tom transskription)';
    };

    const generateIssueFromTranscription = async (
        transcriptions: string[],
        navHistory: string[],
    ): Promise<{ title: string; description: string }> => {
        const systemPrompt = `Du er en hjælpsom assistent der formulerer issue-beskrivelser baseret på brugerens tale-feedback.
Baseret på transskriptionen og de besøgte sider, lav:
1. En kort, præcis titel (maks 80 tegn)
2. En struktureret issue-beskrivelse i markdown med: problemet, steps to reproduce (baseret på besøgte sider), og forventet opførsel.
Svar med JSON: {"title": "...", "description": "..."}.
Svar KUN med JSON, ingen markdown code blocks.`;

        const context = [
            transcriptions.length > 0 ? `TRANSSKRIPTION:\n${transcriptions.join('\n\n')}` : '',
            navHistory.length > 0 ? `BESØGTE SIDER:\n${navHistory.join('\n')}` : '',
        ].filter(Boolean).join('\n\n');

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: context,
                    systemPrompt,
                    tools: [], // no tools needed
                }),
                credentials: 'include',
            });

            if (!res.ok) throw new Error(`AI chat failed: ${res.status}`);

            // Parse SSE response
            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response body');

            let fullText = '';
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value).split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'text') fullText += data.content;
                        } catch { /* skip non-json */ }
                    }
                }
            }

            // Parse JSON from AI response
            const jsonMatch = fullText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    title: parsed.title || 'Feedback Issue',
                    description: parsed.description || fullText,
                };
            }

            return { title: 'Feedback Issue', description: fullText };
        } catch (err) {
            console.error('[AI] Issue generation failed:', err);
            return {
                title: 'Feedback Issue - ' + new Date().toLocaleDateString('da-DK'),
                description: transcriptions.join('\n\n'),
            };
        }
    };

    // ── Auto-process when session loads ────────────────────────────

    const processSession = useCallback(async () => {
        if (!session || processedRef.current || attachments.length === 0) return;
        processedRef.current = true;

        const updated = [...attachments];
        const transcriptions: string[] = [];

        // Step 1: Upload all to blob store + get base64 for screenshots + transcribe audio
        setStep('uploading');

        for (let i = 0; i < updated.length; i++) {
            const att = updated[i];
            try {
                let blob: Blob | undefined;

                if (att.type === 'screenshot') {
                    const ss = session.screenshots.find(s => s.id === att.id);
                    if (ss) blob = await getScreenshotBlobByPath(ss.blobPath);
                } else {
                    const recordings = att.type === 'audio'
                        ? session.voiceRecordings
                        : session.videoRecordings;
                    const rec = recordings.find(r => r.id === att.id);
                    if (rec) blob = await getRecordingBlobByPath(rec.blobPath);
                }

                if (!blob) {
                    updated[i] = { ...att, error: 'Kunne ikke hente fil' };
                    continue;
                }

                // Get base64 for screenshots
                if (att.type === 'screenshot') {
                    const b64 = await blobToBase64(blob);
                    updated[i] = { ...updated[i], base64: b64 };
                }

                // Upload to blob storage
                const formData = new FormData();
                formData.append('file', blob, att.filename);

                const res = await fetch('/api/blobs', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });

                if (!res.ok) {
                    updated[i] = { ...att, error: `Upload fejlede (${res.status})` };
                    continue;
                }

                const result = await res.json();
                updated[i] = { ...updated[i], blobId: result.id, uploaded: true };
            } catch (err) {
                updated[i] = { ...att, error: String(err) };
            }

            setAttachments([...updated]);
        }

        // Step 2: Transcribe voice recordings
        const voiceAttachments = updated.filter(a => a.type === 'audio' && a.uploaded);
        if (voiceAttachments.length > 0) {
            setStep('transcribing');
            for (let i = 0; i < updated.length; i++) {
                const att = updated[i];
                if (att.type !== 'audio' || !att.uploaded) continue;

                const rec = session.voiceRecordings.find(r => r.id === att.id);
                if (!rec) continue;

                const blob = await getRecordingBlobByPath(rec.blobPath);
                if (!blob) continue;

                const text = await transcribeAudio(blob, att.filename);
                updated[i] = { ...updated[i], transcription: text };
                transcriptions.push(text);

                setAttachments([...updated]);
            }
        }

        // Step 3: Generate issue description using AI
        const navHistory = session.navigationHistory.map(
            nav => `- ${nav.title || nav.url} (${nav.url})`
        );
        const screenshotAttachments = updated.filter(a => a.type === 'screenshot' && a.base64);
        const videoAttachments = updated.filter(a => a.type === 'video' && a.uploaded);

        // Build the full description
        setStep('generating');

        // If we have transcriptions, use AI to formulate the issue (single call)
        let aiResult: { title: string; description: string } | null = null;
        if (transcriptions.length > 0) {
            aiResult = await generateIssueFromTranscription(transcriptions, navHistory);
            setGeneratedTitle(aiResult.title);
        }

        // Build final markdown description
        const parts: string[] = [];

        if (feedbackSessionId) {
            parts.push(`> Oprettet fra feedback-session: [${feedbackSessionId.slice(0, 8)}…](/feedback/${feedbackSessionId})`);
            parts.push('');
        }

        if (session.description) {
            parts.push(session.description);
            parts.push('');
        }

        // If we have AI-generated content from transcriptions, add it
        if (aiResult) {
            parts.push('## Beskrivelse (fra tale-feedback)');
            parts.push('');
            parts.push(aiResult.description);
            parts.push('');

            // Also include raw transcriptions
            parts.push('<details>');
            parts.push('<summary>📝 Rå transskription</summary>');
            parts.push('');
            transcriptions.forEach((t, i) => {
                parts.push(`**Optagelse ${i + 1}:**`);
                parts.push(t);
                parts.push('');
            });
            parts.push('</details>');
            parts.push('');
        }

        // Navigation story
        if (session.navigationHistory.length > 0) {
            parts.push('## 🧭 Brugerrejse');
            parts.push('');
            session.navigationHistory.forEach((nav, i) => {
                const ts = new Date(nav.timestamp).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const duration = nav.duration ? ` (${Math.round(nav.duration)}s)` : '';
                parts.push(`${i + 1}. **${ts}** — [${nav.title || nav.url}](${nav.url})${duration}`);
            });
            parts.push('');
        }

        // Screenshots embedded as base64
        if (screenshotAttachments.length > 0) {
            parts.push('## 📸 Screenshots');
            parts.push('');
            screenshotAttachments.forEach((att, i) => {
                const ss = session.screenshots[i];
                const ts = ss ? new Date(ss.timestamp).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                parts.push(`### Screenshot ${i + 1} (${ts})`);
                parts.push('');
                parts.push(`![Screenshot ${i + 1}](${att.base64})`);
                parts.push('');
            });
        }

        // Videos linked from blob store
        if (videoAttachments.length > 0) {
            parts.push('## 🎬 Video-optagelser');
            parts.push('');
            videoAttachments.forEach((att, i) => {
                parts.push(`${i + 1}. 🎬 \`${att.filename}\` — [Åbn video](/api/blobs/${att.blobId})`);
            });
            parts.push('');
        }

        // Session metadata
        parts.push('---');
        parts.push(`*Session: ${session.title} | Startet: ${new Date(session.createdAt).toLocaleString('da-DK')} | Sider: ${session.navigationHistory.length} | Screenshots: ${session.screenshots.length} | Audio: ${session.voiceRecordings.length} | Video: ${session.videoRecordings.length}*`);

        setGeneratedDescription(parts.join('\n'));
        setStep('done');
    }, [session, attachments, feedbackSessionId]);

    // Auto-trigger processing when session and attachments are ready
    useEffect(() => {
        if (session && attachments.length > 0 && !processedRef.current) {
            processSession();
        }
    }, [session, attachments, processSession]);

    const uploadedCount = attachments.filter(a => a.uploaded).length;
    const errorCount = attachments.filter(a => a.error).length;
    const transcribedCount = attachments.filter(a => a.transcription).length;

    const stepLabels: Record<ProcessingStep, string> = {
        idle: 'Forbereder…',
        uploading: '☁️ Uploader filer til blob store…',
        transcribing: '🎤 Transskriberer tale med AI…',
        generating: '🤖 Genererer issue-beskrivelse…',
        done: '✅ Klar!',
    };

    return (
        <div>
            {/* Feedback session processing banner */}
            {feedbackSessionId && (
                <div style={{
                    padding: '14px 18px', marginBottom: 16, borderRadius: 10,
                    background: step === 'done'
                        ? 'rgba(34, 197, 94, 0.06)'
                        : 'rgba(59, 130, 246, 0.06)',
                    border: `1px solid ${step === 'done'
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(59, 130, 246, 0.15)'}`,
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 13, fontWeight: 600, marginBottom: 8,
                    }}>
                        {step !== 'done' ? '⏳' : '✅'} {stepLabels[step]}
                        <span style={{
                            fontSize: 11, fontWeight: 400, fontFamily: 'monospace',
                            color: 'var(--muted-foreground)',
                        }}>
                            {feedbackSessionId.slice(0, 8)}…
                        </span>
                    </div>

                    {/* Progress indicator */}
                    {step !== 'idle' && step !== 'done' && (
                        <div style={{
                            height: 3, borderRadius: 2, overflow: 'hidden',
                            background: 'rgba(59, 130, 246, 0.1)', marginBottom: 10,
                        }}>
                            <div style={{
                                height: '100%', background: '#3b82f6',
                                width: step === 'uploading' ? '33%' : step === 'transcribing' ? '66%' : '90%',
                                transition: 'width 0.5s ease',
                                borderRadius: 2,
                            }} />
                        </div>
                    )}

                    {/* Attachment list */}
                    {attachments.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {attachments.map(att => (
                                <div key={att.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '4px 8px', borderRadius: 6,
                                    background: 'rgba(255,255,255,0.5)',
                                    fontSize: 11,
                                }}>
                                    <span>
                                        {att.type === 'screenshot' ? '📸' : att.type === 'audio' ? '🎤' : '🎬'}
                                    </span>
                                    <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 10 }}>
                                        {att.filename}
                                    </span>
                                    {att.uploaded && (
                                        <span style={{ color: '#22c55e', fontSize: 10 }}>✅ uploaded</span>
                                    )}
                                    {att.transcription && (
                                        <span style={{ color: '#6366f1', fontSize: 10 }}>🎤 transskriberet</span>
                                    )}
                                    {att.base64 && att.type === 'screenshot' && (
                                        <span style={{ color: '#6366f1', fontSize: 10 }}>🖼️ embedded</span>
                                    )}
                                    {att.error && (
                                        <span style={{ color: '#ef4444', fontSize: 10 }}>❌ {att.error}</span>
                                    )}
                                    {!att.uploaded && !att.error && (
                                        <span style={{ color: '#94a3b8', fontSize: 10 }}>⏳ ventende</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary stats */}
                    {step === 'done' && (
                        <div style={{
                            display: 'flex', gap: 12, marginTop: 10,
                            fontSize: 10, color: 'var(--muted-foreground)',
                        }}>
                            <span>☁️ {uploadedCount} uploaded</span>
                            {transcribedCount > 0 && <span>🎤 {transcribedCount} transskriberet</span>}
                            {errorCount > 0 && <span style={{ color: '#ef4444' }}>❌ {errorCount} fejlede</span>}
                        </div>
                    )}
                </div>
            )}

            <IssueForm
                onCreated={() => navigate('/modules/core-issues/issues', { replace: true })}
                defaultTitle={generatedTitle || prefillTitle}
                defaultDescription={generatedDescription}
            />
        </div>
    );
}
