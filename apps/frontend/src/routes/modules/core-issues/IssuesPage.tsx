/**
 * Core Issues — Issues page
 * List view by default, detail view when :issueId is present (deep link).
 */

import { useParams, useNavigate } from 'react-router';
import { IssueList, IssueDetail } from '@surdej/module-core-issues-ui';

export function IssuesPage() {
    const { issueId } = useParams<{ issueId?: string }>();
    const navigate = useNavigate();

    if (issueId) {
        return (
            <IssueDetail
                issueId={issueId}
                onBack={() => navigate('/modules/core-issues/issues', { replace: true })}
            />
        );
    }

    return (
        <IssueList
            onSelect={(id: string) => navigate(`/modules/core-issues/issues/${id}`)}
        />
    );
}
