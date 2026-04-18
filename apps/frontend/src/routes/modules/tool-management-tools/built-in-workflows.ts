/**
 * Built-in Workflow Definitions
 *
 * These are pre-designed multi-step workflows with curated forms,
 * suggested URLs, and structured step guidance.
 *
 * Unlike DB-driven workflows (which are fully generic / AI-chat-driven),
 * built-in workflows have opinionated UIs per step.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface BuiltInStepField {
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'textarea' | 'date' | 'select' | 'url' | 'file';
    required?: boolean;
    placeholder?: string;
    description?: string;
    options?: { value: string; label: string }[];
    /** If true, this field is auto-populated by AI extraction */
    aiExtracted?: boolean;
}

export interface BuiltInStep {
    id: string;
    title: string;
    description: string;
    /** URL the user should navigate to for this step */
    suggestedUrl?: string;
    /** Label for the suggested URL button */
    suggestedUrlLabel?: string;
    /** Instruction text shown prominently */
    instruction?: string;
    /** Form fields specific to this step */
    fields: BuiltInStepField[];
    /** System prompt for the AI chat in advanced mode */
    systemPrompt: string;
    /** Hint shown in the chat area */
    userHint?: string;
    /** Tools available for this step's AI chat */
    allowedTools?: string[];
}

export interface BuiltInWorkflow {
    id: string;
    slug: string;
    label: string;
    description: string;
    icon: string;
    tags: string[];
    steps: BuiltInStep[];
}

// ─── Built-in Workflows ────────────────────────────────────────
// Add domain-specific built-in workflows here.

// ─── Registry ───────────────────────────────────────────────────

export const BUILT_IN_WORKFLOWS: BuiltInWorkflow[] = [];

export function getBuiltInWorkflow(id: string): BuiltInWorkflow | undefined {
    return BUILT_IN_WORKFLOWS.find((w) => w.id === id);
}

/** Look up suggestedUrl info for a task by its taskId across all built-in workflows */
export function getBuiltInStepUrl(taskId: string): { url: string; label?: string } | null {
    for (const wf of BUILT_IN_WORKFLOWS) {
        const step = wf.steps.find((s) => s.id === taskId);
        if (step?.suggestedUrl) return { url: step.suggestedUrl, label: step.suggestedUrlLabel };
    }
    return null;
}
