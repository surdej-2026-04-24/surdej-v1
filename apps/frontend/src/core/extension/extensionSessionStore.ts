import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExtensionSessionStore {
    activeWorkflowSessionId: string | null;
    activeUseCaseId: string | null;
    activeUseCaseLabel: string | null;
    setActiveWorkflowSessionId: (id: string | null) => void;
    setActiveWorkflow: (id: string | null, label: string | null) => void;
}

export const useExtensionSessionStore = create<ExtensionSessionStore>()(
    persist(
        (set) => ({
            activeWorkflowSessionId: null,
            activeUseCaseId: null,
            activeUseCaseLabel: null,
            setActiveWorkflowSessionId: (id) => set({ activeWorkflowSessionId: id }),
            setActiveWorkflow: (id, label) => set({ activeUseCaseId: id, activeUseCaseLabel: label, activeWorkflowSessionId: null }),
        }),
        {
            name: 'surdej-extension-workflow-store',
        }
    )
);
