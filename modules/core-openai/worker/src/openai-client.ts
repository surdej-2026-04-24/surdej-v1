import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
    if (!client) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === 'your-openai-api-key-here') {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        client = new OpenAI({ apiKey });
    }
    return client;
}
