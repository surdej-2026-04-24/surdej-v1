import { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { 
    fetchTasks, createTask, updateTask, deleteTask, type WorkflowTask 
} from './use-case-api';
import { useTranslation } from '@/core/i18n';

export function WorkflowTasksTab({ useCase, onRefresh }: { useCase: any, onRefresh: () => void }) {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<WorkflowTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const loadTasks = async () => {
        setLoading(true);
        try {
            const res = await fetchTasks(useCase.id);
            setTasks(res.items || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTasks(); }, [useCase.id]);

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    const handleCreate = async () => {
        const title = prompt(t('workflow.taskTitlePrompt'));
        if (!title) return;
        const taskId = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        await createTask(useCase.id, {
            title,
            taskId,
            systemPrompt: t('workflow.defaultSystemPrompt'),
            allowedTools: [],
            dataSchema: { type: 'object', properties: {} }
        });
        loadTasks();
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm(t('workflow.deleteTaskConfirm'))) return;
        await deleteTask(useCase.id, taskId);
        loadTasks();
    };

    const handleUpdate = async (taskId: string, updates: Partial<WorkflowTask>) => {
        await updateTask(useCase.id, taskId, updates);
        loadTasks();
    };

    if (loading) return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    );

    return (
        <div className="max-w-4xl space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('workflow.workflowTasks')}</h2>
                <button 
                    onClick={handleCreate} 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                >
                    <Plus className="h-3.5 w-3.5" />
                    {t('workflow.newTask')}
                </button>
            </div>
            
            {tasks.length === 0 ? (
                <div className="text-center p-8 bg-muted/10 border rounded-lg border-dashed">
                    <p className="text-sm text-muted-foreground">{t('workflow.noTasks')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {tasks.map((t, index) => (
                        <TaskItem 
                            key={t.id} 
                            task={t} 
                            index={index}
                            expanded={expandedIds.has(t.id)} 
                            onToggle={() => toggleExpand(t.id)} 
                            onUpdate={(u) => handleUpdate(t.id, u)} 
                            onDelete={() => handleDelete(t.id)} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function TaskItem({ task, index, expanded, onToggle, onUpdate, onDelete }: { 
    task: WorkflowTask, 
    index: number,
    expanded: boolean, 
    onToggle: () => void, 
    onUpdate: (u: any) => void, 
    onDelete: () => void 
}) {
    const [draft, setDraft] = useState(task);
    const [jsonStr, setJsonStr] = useState(JSON.stringify(task.dataSchema, null, 2));
    const { t } = useTranslation();

    return (
        <div className="border rounded-xl bg-card overflow-hidden">
            <div 
                className="flex items-center gap-3 p-4 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors" 
                onClick={onToggle}
            >
                <div className="shrink-0 flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary text-xs font-semibold">
                    {index + 1}
                </div>
                <div className="flex-1 font-medium">{task.title}</div>
                <div className="flex gap-2">
                    {task.allowedTools.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-medium">
                            {t('workflow.toolsCount').replace('{count}', String(task.allowedTools.length))}
                        </span>
                    )}
                </div>
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
            
            {expanded && (
                <div className="p-5 border-t space-y-5 bg-card">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold block mb-1.5">{t('workflow.taskId')}</label>
                            <input 
                                className="border px-3 py-2 w-full rounded-md text-sm bg-background" 
                                value={draft.taskId} 
                                onChange={e => setDraft({...draft, taskId: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold block mb-1.5">{t('workflow.taskTitle')}</label>
                            <input 
                                className="border px-3 py-2 w-full rounded-md text-sm bg-background" 
                                value={draft.title} 
                                onChange={e => setDraft({...draft, title: e.target.value})} 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold block mb-1.5">{t('workflow.taskSystemPrompt')}</label>
                        <textarea 
                            rows={6} 
                            className="border px-3 py-2 w-full rounded-md font-mono text-xs bg-background resize-y" 
                            value={draft.systemPrompt} 
                            onChange={e => setDraft({...draft, systemPrompt: e.target.value})} 
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold block mb-1.5">{t('workflow.allowedTools')}</label>
                        <input 
                            className="border px-3 py-2 w-full rounded-md text-sm bg-background font-mono" 
                            value={draft.allowedTools.join(', ')} 
                            placeholder={t('workflow.allowedToolsPlaceholder')}
                            onChange={e => setDraft({...draft, allowedTools: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} 
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold block mb-1.5">{t('workflow.dataSchema')}</label>
                        <textarea 
                            rows={8} 
                            className="border px-3 py-2 w-full rounded-md font-mono text-xs bg-background resize-y" 
                            value={jsonStr} 
                            onChange={e => {
                                setJsonStr(e.target.value);
                                try {
                                    const parsed = JSON.parse(e.target.value);
                                    setDraft({...draft, dataSchema: parsed});
                                } catch(err) {
                                    // ignore parse errors
                                }
                            }} 
                        />
                    </div>
                    
                    <div className="flex justify-between items-center pt-2">
                        <button 
                            onClick={onDelete} 
                            className="text-red-500 text-xs font-medium px-3 py-1.5 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            {t('workflow.deleteTask')}
                        </button>
                        <button 
                            onClick={() => onUpdate(draft)} 
                            className="bg-primary text-primary-foreground text-sm px-4 py-1.5 rounded-md hover:opacity-90 transition-opacity font-medium"
                        >
                            {t('workflow.saveChanges')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
