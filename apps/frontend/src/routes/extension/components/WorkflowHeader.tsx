/**
 * WorkflowHeader — Horizontal stepper for workflow progress.
 *
 * Shows a compact step indicator at the top of the extension panel.
 * Completed steps are clickable to revert. Active step is highlighted.
 */

import { CheckCircle2, Circle, ChevronRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { WorkflowTask } from '../../modules/tool-management-tools/use-case-api';

export function WorkflowHeader({
    tasks,
    currentStepIdx,
    workflowLabel,
    onRevertToStep,
}: {
    tasks: WorkflowTask[];
    currentStepIdx: number;
    workflowLabel?: string;
    onRevertToStep?: (stepIdx: number) => void;
}) {
    const [confirmRevert, setConfirmRevert] = useState<number | null>(null);

    const handleStepClick = (idx: number) => {
        if (idx >= currentStepIdx) return; // can only revert to completed steps
        if (!onRevertToStep) return;

        if (confirmRevert === idx) {
            onRevertToStep(idx);
            setConfirmRevert(null);
        } else {
            setConfirmRevert(idx);
            // Auto-dismiss after 3s
            setTimeout(() => setConfirmRevert(null), 3000);
        }
    };

    return (
        <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm">
            {/* Workflow name + progress */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs font-semibold text-foreground truncate">
                    {workflowLabel || 'Workflow'}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                    Step {currentStepIdx + 1} of {tasks.length}
                </span>
            </div>

            {/* Horizontal stepper */}
            <div className="flex items-center gap-0 px-4 pb-3 overflow-x-auto">
                {tasks.map((task, idx) => {
                    const isCompleted = idx < currentStepIdx;
                    const isActive = idx === currentStepIdx;
                    const isFuture = idx > currentStepIdx;
                    const isConfirming = confirmRevert === idx;

                    return (
                        <div key={task.id} className="flex items-center min-w-0">
                            {idx > 0 && (
                                <ChevronRight
                                    className={`h-3 w-3 mx-0.5 shrink-0 ${
                                        isCompleted || isActive
                                            ? 'text-primary/40'
                                            : 'text-muted-foreground/20'
                                    }`}
                                />
                            )}
                            <button
                                onClick={() => handleStepClick(idx)}
                                disabled={!isCompleted || !onRevertToStep}
                                className={`
                                    flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all
                                    ${isCompleted
                                        ? 'text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer'
                                        : ''}
                                    ${isActive
                                        ? 'text-primary font-semibold bg-primary/10'
                                        : ''}
                                    ${isFuture
                                        ? 'text-muted-foreground/40 cursor-default'
                                        : ''}
                                    ${isConfirming
                                        ? 'ring-1 ring-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                                        : ''}
                                `}
                                title={
                                    isConfirming
                                        ? 'Click again to revert to this step'
                                        : isCompleted
                                        ? `Revert to: ${task.title}`
                                        : task.title
                                }
                            >
                                {isConfirming ? (
                                    <RotateCcw className="h-3 w-3 shrink-0 animate-pulse" />
                                ) : isCompleted ? (
                                    <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                                ) : isActive ? (
                                    <Circle className="h-3 w-3 shrink-0 text-primary fill-primary/30" />
                                ) : (
                                    <Circle className="h-3 w-3 shrink-0" />
                                )}
                                <span className="truncate max-w-[100px]">{task.title}</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
