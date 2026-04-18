import {
    createContext, useContext, useEffect, useState, useCallback,
    type ReactNode,
    useMemo,
} from 'react';
import { api } from '@/lib/api';
import { useAuth } from '../auth/AuthContext';

// ─── Types ───

export interface Job {
    id: string;
    type: 'export_tenant' | 'import_tenant' | 'copy_tenant';
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    result?: any;
    error?: string;
    userId: string;
    tenantId?: string;
    createdAt: string;
    updatedAt: string;
}

interface JobContextValue {
    jobs: Job[];
    activeJobs: Job[];
    completedJobs: Job[];
    isLoading: boolean;
    startJob: (endpoint: string, payload: unknown) => Promise<Job>;
    refreshJobs: () => Promise<void>;
    dismissJob: (jobId: string) => void;
}

const JobContext = createContext<JobContextValue | null>(null);

// ─── Provider ───

export function JobProvider({ children }: { children: ReactNode }) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { isAuthenticated } = useAuth();

    // Fetch jobs
    const refreshJobs = useCallback(async () => {
        if (!isAuthenticated) {
            setJobs([]);
            return;
        }
        try {
            const data = await api.get<Job[]>('/jobs');
            setJobs(data);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
        }
    }, [isAuthenticated]);

    // Initial load
    useEffect(() => {
        (async () => {
            await refreshJobs();
            setIsLoading(false);
        })();
    }, [refreshJobs]);

    // Polling logic: Poll faster if there are active jobs
    const activeJobs = useMemo(() => jobs.filter(j => ['pending', 'running'].includes(j.status)), [jobs]);
    const completedJobs = useMemo(() => jobs.filter(j => ['completed', 'failed'].includes(j.status)), [jobs]);

    useEffect(() => {
        if (!isAuthenticated) return;

        const hasActive = activeJobs.length > 0;
        const intervalMs = hasActive ? 2000 : 30000; // 2s when working, 30s when idle

        const timer = setInterval(() => {
            refreshJobs();
        }, intervalMs);

        return () => clearInterval(timer);
    }, [isAuthenticated, activeJobs.length, refreshJobs]);

    // Start a job
    const startJob = useCallback(async (endpoint: string, payload: unknown): Promise<Job> => {
        const job = await api.post<Job>(endpoint, payload as any);
        setJobs(prev => [job, ...prev]);
        return job;
    }, []);

    // Dismiss job (remove from local view - optional)
    const dismissJob = useCallback((jobId: string) => {
        setJobs(prev => prev.filter(j => j.id !== jobId));
    }, []);

    return (
        <JobContext.Provider
            value={{
                jobs,
                activeJobs,
                completedJobs,
                isLoading,
                startJob,
                refreshJobs,
                dismissJob,
            }}
        >
            {children}
        </JobContext.Provider>
    );
}

export function useJobs() {
    const ctx = useContext(JobContext);
    if (!ctx) throw new Error('useJobs must be used within JobProvider');
    return ctx;
}
