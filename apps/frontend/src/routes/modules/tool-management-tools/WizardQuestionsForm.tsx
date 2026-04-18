import { useState } from 'react';
import { Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WizardQuestion = {
    id: string;
    label: string;
    type: 'radio' | 'multiselect' | 'text';
    options?: string[];
};

export type WizardQuestions = {
    intro: string;
    questions: WizardQuestion[];
};

interface WizardQuestionsFormProps {
    questions: WizardQuestions;
    onSubmit: (answers: string) => void;
    disabled?: boolean;
}

export function WizardQuestionsForm({ questions, onSubmit, disabled }: WizardQuestionsFormProps) {
    const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

    const updateAnswer = (id: string, value: string | string[]) => {
        setAnswers((prev) => ({ ...prev, [id]: value }));
    };

    const toggleMultiselect = (id: string, option: string) => {
        setAnswers((prev) => {
            const current = (prev[id] as string[]) || [];
            const next = current.includes(option)
                ? current.filter((o) => o !== option)
                : [...current, option];
            return { ...prev, [id]: next };
        });
    };

    const handleSubmit = () => {
        const parts: string[] = [];
        for (const q of questions.questions) {
            const answer = answers[q.id];
            if (!answer || (Array.isArray(answer) && answer.length === 0)) continue;
            const value = Array.isArray(answer) ? answer.join(', ') : answer;
            parts.push(`**${q.label}**: ${value}`);
        }
        if (parts.length > 0) {
            onSubmit(parts.join('\n'));
        }
    };

    const hasAnyAnswer = questions.questions.some((q) => {
        const a = answers[q.id];
        return a && (typeof a === 'string' ? a.trim() : a.length > 0);
    });

    return (
        <div className="space-y-4">
            {questions.intro && (
                <p className="text-sm text-muted-foreground">{questions.intro}</p>
            )}

            {questions.questions.map((q) => (
                <div key={q.id} className="space-y-2">
                    <label className="text-sm font-medium">{q.label}</label>

                    {q.type === 'radio' && q.options && (
                        <div className="space-y-1.5">
                            {q.options.map((opt) => {
                                const selected = answers[q.id] === opt;
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => updateAnswer(q.id, opt)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg border transition-all text-left',
                                            selected
                                                ? 'bg-primary/10 border-primary text-foreground'
                                                : 'bg-card hover:bg-muted/50 border-border',
                                        )}
                                    >
                                        <div className={cn(
                                            'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                                            selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                                        )}>
                                            {selected && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                                        </div>
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {q.type === 'multiselect' && q.options && (
                        <div className="space-y-1.5">
                            {q.options.map((opt) => {
                                const selected = ((answers[q.id] as string[]) || []).includes(opt);
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => toggleMultiselect(q.id, opt)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg border transition-all text-left',
                                            selected
                                                ? 'bg-primary/10 border-primary text-foreground'
                                                : 'bg-card hover:bg-muted/50 border-border',
                                        )}
                                    >
                                        <div className={cn(
                                            'h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                                            selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                                        )}>
                                            {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                                        </div>
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {q.type === 'text' && (
                        <input
                            type="text"
                            disabled={disabled}
                            value={(answers[q.id] as string) || ''}
                            onChange={(e) => updateAnswer(q.id, e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
                            placeholder="Type your answer…"
                        />
                    )}
                </div>
            ))}

            <Button
                size="sm"
                onClick={handleSubmit}
                disabled={disabled || !hasAnyAnswer}
                className="gap-2"
            >
                <Send className="h-3.5 w-3.5" />
                Submit Answers
            </Button>
        </div>
    );
}

/**
 * Try to extract a _wizardQuestions JSON block from text.
 * Returns the parsed questions and the remaining text (without the JSON block).
 */
export function parseWizardQuestions(content: string): { questions: WizardQuestions | null; cleanedContent: string } {
    const match = content.match(/```json\n\{\s*"_wizardQuestions"[\s\S]*?\n```/);
    if (!match) return { questions: null, cleanedContent: content };

    try {
        const jsonStr = match[0].replace(/```json\n|\n```/g, '');
        const parsed = JSON.parse(jsonStr);
        if (parsed._wizardQuestions?.questions) {
            const cleaned = content.replace(match[0], '').trim();
            return { questions: parsed._wizardQuestions, cleanedContent: cleaned };
        }
    } catch {
        // Ignore parse errors
    }
    return { questions: null, cleanedContent: content };
}
