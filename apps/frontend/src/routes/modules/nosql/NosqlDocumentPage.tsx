import { useParams, useNavigate } from 'react-router';
import { useState } from 'react';
import { DocumentDetail, VersionHistory } from '@surdej/module-member-nosql-ui';

type Panel = 'detail' | 'versions';

export function NosqlDocumentPage() {
    const { documentId } = useParams<{ documentId: string }>();
    const navigate = useNavigate();
    const [panel, setPanel] = useState<Panel>('detail');
    const [currentVersion, setCurrentVersion] = useState(1);

    if (!documentId) {
        return (
            <div style={{ padding: 24, color: 'var(--muted-foreground, #6b7280)', fontSize: 14 }}>
                No document ID specified.
            </div>
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {panel === 'detail' && (
                <DocumentDetail
                    documentId={documentId}
                    onBack={() => navigate(-1)}
                    onShowVersions={() => setPanel('versions')}
                />
            )}
            {panel === 'versions' && (
                <VersionHistory
                    documentId={documentId}
                    currentVersion={currentVersion}
                    onBack={() => setPanel('detail')}
                    onRestored={() => setPanel('detail')}
                />
            )}
        </div>
    );
}
