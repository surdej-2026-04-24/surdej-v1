/**
 * WorkflowSimulator — Multi-step form that walks through workflow tasks,
 * collecting data per step according to each task's dataSchema.
 * Shows progress, allows back/next navigation, and tracks collected data.
 */

import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, RotateCcw, CircleDot, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TaskDef = {
    title: string;
    systemPrompt: string;
    allowedTools: string[];
    dataSchema: {
        type?: string;
        properties?: Record<string, { type: string; description?: string; enum?: string[]; multiline?: boolean }>;
        required?: string[];
    };
    seedData?: Record<string, unknown> | null;
    userHint?: string | null;
};

export type SimulationData = Record<string, Record<string, string>>;

interface WorkflowSimulatorProps {
    tasks: TaskDef[];
    onDataChange: (data: SimulationData) => void;
    disabled?: boolean;
}

export function WorkflowSimulator({ tasks, onDataChange, disabled }: WorkflowSimulatorProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [stepData, setStepData] = useState<SimulationData>({});
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

    const task = tasks[currentStep];
    const properties = task?.dataSchema?.properties ?? {};
    const requiredFields = task?.dataSchema?.required ?? [];
    const fieldEntries = Object.entries(properties);
    const currentValues = stepData[`step-${currentStep}`] ?? {};

    const updateField = useCallback((field: string, value: string) => {
        setStepData((prev) => {
            const stepKey = `step-${currentStep}`;
            const next = {
                ...prev,
                [stepKey]: { ...prev[stepKey], [field]: value },
            };
            onDataChange(next);
            return next;
        });
    }, [currentStep, onDataChange]);

    const isStepValid = requiredFields.every((f) => (currentValues[f] ?? '').trim() !== '');

    const markComplete = useCallback(() => {
        setCompletedSteps((prev) => new Set([...prev, currentStep]));
        if (currentStep < tasks.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    }, [currentStep, tasks.length]);

    const handleReset = useCallback(() => {
        setStepData({});
        setCompletedSteps(new Set());
        setCurrentStep(0);
        onDataChange({});
    }, [onDataChange]);

    const handleSeedStep = useCallback(() => {
        if (!task?.seedData) return;
        const stepKey = `step-${currentStep}`;
        setStepData((prev) => {
            const seeded: Record<string, string> = {};
            for (const [key, val] of Object.entries(task.seedData!)) {
                seeded[key] = String(val ?? '');
            }
            const next = { ...prev, [stepKey]: { ...prev[stepKey], ...seeded } };
            onDataChange(next);
            return next;
        });
    }, [currentStep, task, onDataChange]);

    if (!tasks.length) return null;

    return (
        <div className="space-y-4">
            {/* Step progress bar */}
            <div className="flex items-center gap-1">
                {tasks.map((t, i) => {
                    const completed = completedSteps.has(i);
                    const active = i === currentStep;
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setCurrentStep(i)}
                            className={cn(
                                'flex items-center gap-1.5 px-2 py-1 text-[10px] rounded-md transition-all',
                                active ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium'
                                    : completed ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                            )}
                        >
                            <div className={cn(
                                'h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                                completed ? 'bg-emerald-500 text-white' : active ? 'bg-amber-500 text-white' : 'bg-muted-foreground/20',
                            )}>
                                {completed ? <Check className="h-2.5 w-2.5" /> : i + 1}
                            </div>
                            <span className="truncate max-w-[100px]">{t.title.replace(/^Step \d+:\s*/i, '')}</span>
                        </button>
                    );
                })}
            </div>

            {/* Current step card */}
            <div className="border rounded-lg bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b">
                    <div className="flex items-center gap-2">
                        <CircleDot className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">{task.title}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                            Step {currentStep + 1} of {tasks.length}
                        </span>
                        {task.seedData && Object.keys(task.seedData).length > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleSeedStep}
                                disabled={disabled}
                                className="gap-1 text-[10px] h-6 px-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title="Fill form with example test data"
                            >
                                <Zap className="h-3 w-3" />
                                Seed
                            </Button>
                        )}
                    </div>
                    {task.userHint && (
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1.5 flex items-start gap-1.5">
                            <span className="shrink-0 mt-0.5">💡</span>
                            <span>{task.userHint}</span>
                        </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{task.systemPrompt}</p>
                </div>

                <div className="p-4 space-y-3">
                    {fieldEntries.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No data schema defined for this step.</p>
                    ) : (
                        fieldEntries.map(([key, prop]) => {
                            const isRequired = requiredFields.includes(key);
                            const value = currentValues[key] ?? '';

                            if (prop.enum && prop.enum.length > 0) {
                                return (
                                    <div key={key} className="space-y-1.5">
                                        <label className="text-xs font-medium flex items-center gap-1">
                                            {key}
                                            {isRequired && <span className="text-destructive">*</span>}
                                            {prop.description && (
                                                <span className="text-muted-foreground font-normal">— {prop.description}</span>
                                            )}
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {prop.enum.map((opt) => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => updateField(key, opt)}
                                                    className={cn(
                                                        'px-2.5 py-1 text-xs rounded-md border transition-all',
                                                        value === opt
                                                            ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300'
                                                            : 'bg-card hover:bg-muted border-border',
                                                    )}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={key} className="space-y-1">
                                    <label className="text-xs font-medium flex items-center gap-1">
                                        {key}
                                        {isRequired && <span className="text-destructive">*</span>}
                                        <span className="text-muted-foreground font-normal text-[10px]">({prop.type})</span>
                                        {prop.description && (
                                            <span className="text-muted-foreground font-normal">— {prop.description}</span>
                                        )}
                                    </label>
                                    {prop.type === 'string' && (prop.multiline || value.length > 80 || key.toLowerCase().includes('content') || key.toLowerCase().includes('text') || key.toLowerCase().includes('summary')) ? (
                                        <textarea
                                            disabled={disabled}
                                            value={value}
                                            onChange={(e) => updateField(key, e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-amber-400 outline-none resize-y"
                                            placeholder={`Enter ${key}…`}
                                        />
                                    ) : (
                                        <input
                                            type={prop.type === 'number' ? 'number' : 'text'}
                                            disabled={disabled}
                                            value={value}
                                            onChange={(e) => updateField(key, e.target.value)}
                                            className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-amber-400 outline-none"
                                            placeholder={`Enter ${key}…`}
                                        />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Navigation */}
                <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                        className="gap-1 text-xs"
                    >
                        <ChevronLeft className="h-3 w-3" />
                        Back
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleReset}
                            className="gap-1 text-xs text-muted-foreground"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                        </Button>

                        {currentStep < tasks.length - 1 ? (
                            <Button
                                size="sm"
                                onClick={markComplete}
                                disabled={!isStepValid}
                                className="gap-1 text-xs"
                            >
                                Next
                                <ChevronRight className="h-3 w-3" />
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={markComplete}
                                disabled={!isStepValid}
                                className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Check className="h-3 w-3" />
                                Complete
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Collected data summary */}
            {Object.keys(stepData).length > 0 && (
                <div className="border rounded-lg p-3 bg-muted/10">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">Collected Data</div>
                    <div className="space-y-2">
                        {tasks.map((t, i) => {
                            const data = stepData[`step-${i}`];
                            if (!data || Object.keys(data).length === 0) return null;
                            return (
                                <div key={i} className="text-xs">
                                    <span className="font-medium">{t.title}:</span>
                                    <div className="ml-3 mt-0.5 space-y-0.5">
                                        {Object.entries(data).map(([k, v]) => (
                                            <div key={k} className="flex gap-2">
                                                <span className="text-muted-foreground font-mono">{k}:</span>
                                                <span className="truncate">{v || '—'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
