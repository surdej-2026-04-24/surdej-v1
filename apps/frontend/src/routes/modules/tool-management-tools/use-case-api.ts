/**
 * API client for use case management endpoints.
 *
 * Talks to the tool-management-tools module worker via the gateway proxy.
 */

import type {
    CreateDbUseCase,
    UpdateDbUseCase,
    CreateUseCaseVersion,
    CreateUseCaseTestCase,
    UpdateUseCaseTestCase,
    RunTestsRequest,
} from '@surdej/module-tool-management-tools-shared';

const BASE = '/api/module/tool-management-tools';

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { ...opts?.headers as Record<string, string> };
    if (opts?.body) headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `API error ${res.status}`);
    }
    return res.json();
}

// ─── Use Cases ─────────────────────────────────────────────────

export interface UseCaseListItem {
    id: string;
    slug: string;
    label: string;
    description: string | null;
    icon: string | null;
    isBuiltIn: boolean;
    isActive: boolean;
    latestVersion: { id: string; version: number; modelTier: string; promptTemplate: string; tools: string[] } | null;
    tags: string[];
    testCaseCount: number;
    createdAt: string;
    updatedAt: string;
}

export async function fetchUseCases(includeBuiltIn = true) {
    return api<{ items: UseCaseListItem[]; total: number; builtIn?: unknown[] }>(
        `/use-cases?includeBuiltIn=${includeBuiltIn}`,
    );
}

// ─── Active Use Cases (for toolbar / extension) ────────────────

export interface ActiveUseCase {
    id: string;
    slug: string;
    label: string;
    description: string;
    icon: string;
    promptTemplate: string;
    tools: string[];
    modelTier: string;
    tags: string[];
    source: 'db' | 'built-in';
    workflowMode?: boolean;
    tasks?: WorkflowTask[];
}

export async function fetchActiveUseCases(): Promise<ActiveUseCase[]> {
    try {
        const res = await api<{ items: ActiveUseCase[] }>('/use-cases/active');
        return res.items;
    } catch {
        // Fallback: return empty — consumers should use BUILT_IN_USE_CASES as offline fallback
        return [];
    }
}

export async function ensureBuiltInWorkflow(slug: string): Promise<{ id: string; slug: string; label: string }> {
    return api<{ id: string; slug: string; label: string }>('/workflows/ensure-builtin', {
        method: 'POST',
        body: JSON.stringify({ slug }),
    });
}

export async function fetchUseCase(id: string) {
    return api<UseCaseListItem & {
        workflowMode?: boolean;
        tasks?: any[];
        versions: { id: string; version: number; modelTier: string; promptTemplate: string; tools: string[]; changelog: string | null; createdAt: string }[];
        testCases: {
            id: string;
            name: string;
            userPrompt: string;
            evaluationPrompt: string;
            expectedBehavior: string | null;
            isActive: boolean;
            sortOrder: number;
            attachments: { id: string; filename: string; mimeType: string; sizeBytes: number; createdAt: string }[];
        }[];
    }>(`/use-cases/${id}`);
}

export async function createUseCase(data: CreateDbUseCase) {
    return api<UseCaseListItem>('/use-cases', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateUseCase(id: string, data: UpdateDbUseCase) {
    return api<UseCaseListItem>(`/use-cases/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteUseCase(id: string) {
    return api<{ success: boolean }>(`/use-cases/${id}`, { method: 'DELETE' });
}

// ─── Versions ──────────────────────────────────────────────────

export async function createVersion(useCaseId: string, data: CreateUseCaseVersion) {
    return api<{ id: string; version: number }>(`/use-cases/${useCaseId}/versions`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function fetchVersions(useCaseId: string) {
    return api<{ items: { id: string; version: number; modelTier: string; promptTemplate: string; tools: string[]; changelog: string | null; createdAt: string; testRunCount: number }[]; total: number }>(
        `/use-cases/${useCaseId}/versions`,
    );
}

// ─── Test Cases ────────────────────────────────────────────────

export async function createTestCase(useCaseId: string, data: CreateUseCaseTestCase) {
    return api<{ id: string }>(`/use-cases/${useCaseId}/test-cases`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function suggestTestCases(useCaseId: string): Promise<CreateUseCaseTestCase[]> {
    return api<CreateUseCaseTestCase[]>(`/use-cases/${useCaseId}/suggest-tests`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

export async function updateTestCase(useCaseId: string, testCaseId: string, data: UpdateUseCaseTestCase) {
    return api<{ id: string }>(`/use-cases/${useCaseId}/test-cases/${testCaseId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteTestCase(useCaseId: string, testCaseId: string) {
    return api<{ success: boolean }>(`/use-cases/${useCaseId}/test-cases/${testCaseId}`, {
        method: 'DELETE',
    });
}

// ─── Attachments ───────────────────────────────────────────────

export async function uploadAttachment(useCaseId: string, testCaseId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(
        `${BASE}/use-cases/${useCaseId}/test-cases/${testCaseId}/attachments`,
        { method: 'POST', body: form },
    );
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json() as Promise<{ id: string; filename: string; mimeType: string; sizeBytes: number }>;
}

export async function deleteAttachment(attId: string) {
    return api<{ success: boolean }>(`/attachments/${attId}`, {
        method: 'DELETE',
    });
}

export function getAttachmentUrl(attId: string) {
    return `/api/module/tool-management-tools/attachments/${attId}`;
}

export async function uploadWorkflowAttachment(useCaseId: string, taskId: string | null, file: File) {
    const form = new FormData();
    form.append('file', file);
    const url = taskId 
        ? `${BASE}/use-cases/${useCaseId}/tasks/${taskId}/attachments`
        : `${BASE}/use-cases/${useCaseId}/attachments`;
        
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
}

export async function fetchWorkflowAttachments(useCaseId: string) {
    return api<any[]>(`/use-cases/${useCaseId}/attachments`, {
        method: 'GET',
    });
}

export async function deleteWorkflowAttachment(attId: string) {
    return api<{ success: boolean }>(`/workflow-attachments/${attId}`, {
        method: 'DELETE',
    });
}

export function getWorkflowAttachmentUrl(attId: string) {
    return `/api/modules/tool-management-tools/workflow-attachments/${attId}`;
}

// ─── Test Runner ───────────────────────────────────────────────

export interface TestRunResult {
    id: string;
    testCaseId: string;
    versionId: string;
    status: string;
    modelTier: string;
    aiResponse: string | null;
    evaluationResult: { passed: boolean; score?: number; reasoning: string } | null;
    durationMs: number | null;
    tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
    error: string | null;
    createdAt: string;
}

export interface TestRunSummary {
    useCaseId: string;
    versionId: string;
    totalTests: number;
    passed: number;
    failed: number;
    errors: number;
    runs: TestRunResult[];
}

export async function runTests(useCaseId: string, data: RunTestsRequest) {
    return api<TestRunSummary>(`/use-cases/${useCaseId}/run-tests`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function fetchTestRuns(useCaseId: string, versionId?: string) {
    const qs = versionId ? `?versionId=${versionId}` : '';
    return api<{ items: (TestRunResult & { testCase: { id: string; name: string }; version: { id: string; version: number } })[]; total: number }>(
        `/use-cases/${useCaseId}/test-runs${qs}`,
    );
}

// ─── Workflow Tasks ────────────────────────────────────────────

export interface WorkflowTask {
    id: string;
    useCaseId: string;
    taskId: string;
    title: string;
    sortOrder: number;
    systemPrompt: string;
    allowedTools: string[];
    dataSchema: any;
    seedData?: Record<string, unknown> | null;
    userHint?: string | null;
    description: string | null;
}

export async function fetchTasks(useCaseId: string) {
    return api<{ items: WorkflowTask[] }>(`/use-cases/${useCaseId}/tasks`);
}

export async function createTask(useCaseId: string, data: any) {
    return api<WorkflowTask>(`/use-cases/${useCaseId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateTask(useCaseId: string, taskId: string, data: any) {
    return api<WorkflowTask>(`/use-cases/${useCaseId}/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteTask(useCaseId: string, taskId: string) {
    return api<{ success: boolean }>(`/use-cases/${useCaseId}/tasks/${taskId}`, { method: 'DELETE' });
}

export async function reorderTasks(useCaseId: string, taskIds: string[]) {
    return api<{ success: boolean }>(`/use-cases/${useCaseId}/tasks/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ taskIds }),
    });
}

// ─── Sessions ──────────────────────────────────────────────────

export interface WorkflowSession {
    id: string;
    useCaseId: string;
    currentStepIdx: number;
    status: 'active' | 'completed' | 'aborted';
    formData: Record<string, unknown>;
    tasks: WorkflowTask[];
    messages: any[];
}

export async function startSession(useCaseId: string) {
    return api<WorkflowSession>(`/workflows/${useCaseId}/sessions/start`, { method: 'POST', body: JSON.stringify({}) });
}

export async function getSession(sessionId: string) {
    return api<WorkflowSession>(`/sessions/${sessionId}`);
}

export async function advanceSession(sessionId: string) {
    return api<{ nextStepIdx: number; completed: boolean }>(`/sessions/${sessionId}/advance`, { method: 'POST', body: JSON.stringify({}) });
}

export async function revertSession(sessionId: string, targetStepIndex: number) {
    return api<{ success: boolean }>(`/sessions/${sessionId}/revert`, {
        method: 'POST',
        body: JSON.stringify({ targetStepIndex }),
    });
}

export async function updateSessionForm(sessionId: string, fields: Record<string, unknown>) {
    return api<{ success: boolean; formData: any }>(`/sessions/${sessionId}/update-form`, {
        method: 'POST',
        body: JSON.stringify(fields),
    });
}

export async function abortSession(sessionId: string) {
    return api<{ success: boolean }>(`/sessions/${sessionId}/abort`, { method: 'POST', body: JSON.stringify({}) });
}

export async function completeSessionExplicit(sessionId: string) {
    return api<{ success: boolean }>(`/sessions/${sessionId}/complete`, { method: 'POST', body: JSON.stringify({}) });
}

export async function listSessions(useCaseId: string) {
    return api<{ items: any[] }>(`/workflows/${useCaseId}/sessions`);
}

export async function listAllSessions() {
    return api<{ items: any[] }>('/sessions');
}

// ─── Session Debug (full detail) ───────────────────────────────

export interface SessionSnapshot {
    id: string;
    sessionId: string;
    stepIndex: number;
    formData: Record<string, unknown>;
    createdAt: string;
}

export interface SessionMessage {
    id: string;
    sessionId: string;
    stepIndex: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata: unknown;
    createdAt: string;
}

export interface WorkflowSessionDebug {
    id: string;
    useCaseId: string;
    userId: string;
    tenantId: string | null;
    currentStepIdx: number;
    status: 'active' | 'completed' | 'aborted';
    formData: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    useCase: {
        label: string;
        slug: string;
        icon: string | null;
        description: string | null;
        workflowMode: boolean;
        latestVersion: { id: string; version: number; modelTier: string; promptTemplate: string; tools: string[] } | null;
    };
    tasks: WorkflowTask[];
    messages: SessionMessage[];
    snapshots: SessionSnapshot[];
}

export async function getSessionDebug(sessionId: string) {
    return api<WorkflowSessionDebug>(`/sessions/${sessionId}/debug`);
}

// ─── Workflow Tags ─────────────────────────────────────────────

export interface WorkflowTagItem {
    id: string;
    name: string;
    label: string;
    color: string;
    description: string | null;
    sortOrder: number;
    useCaseCount?: number;
    createdAt: string;
    updatedAt: string;
}

export async function fetchWorkflowTags() {
    return api<{ items: WorkflowTagItem[] }>('/workflow-tags');
}

export async function createWorkflowTag(data: { name: string; label: string; color?: string; description?: string; sortOrder?: number }) {
    return api<WorkflowTagItem>('/workflow-tags', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateWorkflowTag(id: string, data: { name?: string; label?: string; color?: string; description?: string; sortOrder?: number }) {
    return api<WorkflowTagItem>(`/workflow-tags/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteWorkflowTag(id: string) {
    return api<{ success: boolean }>(`/workflow-tags/${id}`, { method: 'DELETE' });
}

export async function fetchUseCaseTags(useCaseId: string) {
    return api<{ items: WorkflowTagItem[] }>(`/use-cases/${useCaseId}/tags`);
}

export async function setUseCaseTags(useCaseId: string, tagIds: string[]) {
    return api<{ items: WorkflowTagItem[] }>(`/use-cases/${useCaseId}/tags`, {
        method: 'PUT',
        body: JSON.stringify({ tagIds }),
    });
}
