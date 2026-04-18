/**
 * Module Index Page
 *
 * Smart index route for /modules/:moduleId.
 * Renders the correct domain dashboard based on the module context.
 */

import { useOutletContext } from 'react-router';
import type { ModuleOutletContext } from '@/routes/modules/ModuleLayout';
import { Puzzle } from 'lucide-react';
import { useTranslation } from '@/core/i18n';

/** Slug → dashboard component mapping. Add domain dashboards here. */
const DASHBOARD_MAP: Record<string, React.FC> = {
};

export function ModuleIndexPage() {
    const { module } = useOutletContext<ModuleOutletContext>();
    const Dashboard = DASHBOARD_MAP[module.slug];
    const { t } = useTranslation();

    if (!Dashboard) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center text-muted-foreground">
                <Puzzle className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">{t('modules.noDashboard')}</p>
                <p className="text-xs mt-1">{t('modules.noDashboardHint', { slug: module.slug })}</p>
            </div>
        );
    }

    return <Dashboard />;
}
