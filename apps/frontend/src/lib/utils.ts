import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function enhanceMarkdown(content: string) {
    if (!content) return content;

    // 1. Convert plain citations [1], [2] to markdown links
    const enhanced = content.replace(/\[(\d+)\](?!\()/g, '[$1](#source-$1)');

    // 2. Identify Sections
    let inProposals = false;
    let inSources = false;

    const lines = enhanced.split('\n');
    const processed = lines.map((line) => {
        const lowerLine = line.toLowerCase();

        // Detect section headers (allowing **, *, or # prefixes)
        if (lowerLine.match(/^([#*\s]*)(forslag|proposals|næste skridt|next steps|suggested queries)/i)) {
            inProposals = true;
            inSources = false;
            return line;
        }
        if (lowerLine.match(/^([#*\s]*)(kilder|sources|referencer|references)/i)) {
            inSources = true;
            inProposals = false;
            return line;
        }

        // Process list items
        const listMatch = line.match(/^(\s*[*-]\s+)(.+)/);
        if (listMatch) {
            const [, prefix, text] = listMatch;
            if (inProposals && !text.includes('](')) {
                return `${prefix}[${text.replace(/"/g, '&quot;')}](#proposal)`;
            }
            if (inSources && !text.includes('](')) {
                return `${prefix}[${text.replace(/"/g, '&quot;')}](#source)`;
            }
        }
        return line;
    });

    return processed.join('\n');
}
