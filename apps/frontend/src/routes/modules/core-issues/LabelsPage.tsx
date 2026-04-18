/**
 * Core Issues — Labels management page
 */

import { useNavigate } from 'react-router';
import { LabelManager } from '@surdej/module-core-issues-ui';

export function LabelsPage() {
    const navigate = useNavigate();

    return (
        <LabelManager
            onClose={() => navigate('/modules/core-issues', { replace: true })}
        />
    );
}
