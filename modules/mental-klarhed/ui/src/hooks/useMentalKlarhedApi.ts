import {
    MODULE_NAME,
    ClientPortalStateSchema,
    AssessmentSchema,
    EvaluationSchema,
    ProgrammeListResponseSchema,
    ProgrammeSchema,
    PreSessionMaterialSchema,
    type Assessment,
    type ClientPortalState,
    type SubmitAssessment,
    type CreateProgramme,
    type Programme,
    type ProgrammeListResponse,
    type PreSessionMaterial,
    type Evaluation,
} from '@surdej/module-mental-klarhed-shared';
import { z } from 'zod';

const BASE = `/api/module/${MODULE_NAME}`;

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...opts,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
}

export function useMentalKlarhedApi() {
    return {
        // ─── Admin ───────────────────────────────────────────
        listProgrammes: async (): Promise<ProgrammeListResponse> => {
            const data = await request<unknown>('/admin/programmes');
            return ProgrammeListResponseSchema.parse(data);
        },

        getProgramme: async (id: string): Promise<Programme> => {
            const data = await request<unknown>(`/admin/programmes/${id}`);
            return ProgrammeSchema.parse(data);
        },

        createProgramme: async (input: CreateProgramme): Promise<{ programmeId: string }> => {
            return request('/admin/programmes', { method: 'POST', body: JSON.stringify(input) });
        },

        sendAssessmentLink: async (programmeId: string, sessionNumber: number): Promise<void> => {
            await request(`/admin/programmes/${programmeId}/sessions/${sessionNumber}/send-assessment`, {
                method: 'POST',
            });
        },

        getSessionMaterial: async (programmeId: string, sessionNumber: number): Promise<PreSessionMaterial> => {
            const data = await request<unknown>(
                `/admin/programmes/${programmeId}/sessions/${sessionNumber}/material`
            );
            return PreSessionMaterialSchema.parse(data);
        },

        sendMaterial: async (programmeId: string, sessionNumber: number): Promise<void> => {
            await request(`/admin/programmes/${programmeId}/sessions/${sessionNumber}/send-material`, {
                method: 'POST',
            });
        },

        getAssessments: async (programmeId: string): Promise<Assessment[]> => {
            const data = await request<unknown>(`/admin/programmes/${programmeId}/assessments`);
            return z.object({ items: z.array(AssessmentSchema) }).parse(data).items;
        },

        // ─── Client ──────────────────────────────────────────
        getPortalState: async (): Promise<ClientPortalState> => {
            const data = await request<unknown>('/client/me');
            return ClientPortalStateSchema.parse(data);
        },

        submitAssessment: async (body: SubmitAssessment & { sessionId?: string }): Promise<{ assessmentId: string }> => {
            return request('/client/assessments', { method: 'POST', body: JSON.stringify(body) });
        },

        getSessionMaterialForClient: async (sessionId: string): Promise<PreSessionMaterial> => {
            const data = await request<unknown>(`/client/materials/${sessionId}`);
            return PreSessionMaterialSchema.parse(data);
        },

        getEvaluation: async (): Promise<Evaluation> => {
            const data = await request<unknown>('/client/evaluation');
            return EvaluationSchema.parse(data);
        },

        exportData: async (): Promise<unknown> => {
            return request('/client/me/export');
        },

        deleteMyData: async (): Promise<void> => {
            await request('/client/me', { method: 'DELETE' });
        },
    };
}
