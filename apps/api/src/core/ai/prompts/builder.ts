import { GlobalAdvisorPersona } from './base-persona.js';

export interface UseCaseContext {
    id: string;
    domain?: string;
    promptTemplate?: string;   // Task-specific instructions
}

function generateToolPrompt(enabledToolIds: string[], allTools: Record<string, any>) {
    const lines = ["Du har adgang til følgende værktøjer:"];
    for (const id of enabledToolIds) {
        const tool = allTools[id];
        if (tool) {
            lines.push(`- **${id}**: ${tool.description}`);
        }
    }
    return lines.join('\n');
}

export function buildMergedSystemPrompt(
    useCase: UseCaseContext | null,
    enabledToolIds: string[],
    mcpRegistry: Record<string, any>
): string {
    const domain = useCase?.domain || "Real Estate/Financial Analysis";

    // 1. Render Base Persona
    const roleStr = GlobalAdvisorPersona.role.replace('{{domain}}', domain);
    const principlesStr = GlobalAdvisorPersona.principles.map(p => `1. ${p}`).join('\n');

    // 2. Render Tools
    const toolsStr = generateToolPrompt(enabledToolIds, mcpRegistry);

    // 3. Assemble
    const parts = [
        roleStr,
        toolsStr,
        `VIGTIGE REGLER:\n${principlesStr}`
    ];

    if (useCase?.promptTemplate) {
        parts.push(`OPGAVE-SPECIFIKKE INSTRUKTIONER:\n${useCase.promptTemplate}`);
    }

    parts.push(`SVARFORMAT:\n${GlobalAdvisorPersona.responseStructure}`);

    return parts.join('\n\n');
}
