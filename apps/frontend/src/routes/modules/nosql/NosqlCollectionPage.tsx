import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { CollectionBrowser, DocumentList, DocumentDetail, VersionHistory } from '@surdej/module-member-nosql-ui';
import { useNosqlApi } from '@surdej/module-member-nosql-ui';
import type { Collection, Document } from '@surdej/module-member-nosql-shared';
import { useCommandRegistry } from '@/core/commands/CommandRegistry';

type Panel = 'list' | 'detail' | 'versions';

export function NosqlCollectionPage() {
    const { collectionId, documentId } = useParams<{ collectionId?: string; documentId?: string }>();
    const navigate = useNavigate();
    const api = useNosqlApi();
    const register = useCommandRegistry((s) => s.register);

    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [panel, setPanel] = useState<Panel>('list');

    // When navigating directly to a document URL, fetch the document and its collection
    useEffect(() => {
        if (!documentId) return;
        api.getDocument(documentId).then((doc) => {
            setSelectedDoc(doc);
            setPanel('detail');
            // Also load the parent collection for sidebar/breadcrumb context
            api.getCollection(doc.collectionId).then(setSelectedCollection).catch(() => {});
        }).catch(() => {
            setSelectedDoc(null);
        });
    }, [documentId]);

    // Load collection metadata when collectionId changes
    useEffect(() => {
        if (!collectionId) return;
        api.getCollection(collectionId).then(setSelectedCollection).catch(() => setSelectedCollection(null));
    }, [collectionId]);

    // Dynamically register sidebar-pinnable commands for loaded collections
    useEffect(() => {
        if (!selectedCollection) return;
        const cmdId = `nosql.collection.${selectedCollection.id}`;
        const dispose = register({
            id: cmdId,
            label: `NoSQL: ${selectedCollection.name}`,
            group: 'NoSQL Store',
            icon: 'FolderOpen',
            execute: () => navigate(`/modules/nosql/collections/${selectedCollection.id}`),
        });
        return dispose;
    }, [selectedCollection, register, navigate]);

    const handleCollectionSelect = useCallback((collection: Collection) => {
        setSelectedCollection(collection);
        setSelectedDoc(null);
        setPanel('list');
        navigate(`/modules/nosql/collections/${collection.id}`);
    }, [navigate]);

    const handleDocSelect = useCallback((doc: Document) => {
        setSelectedDoc(doc);
        setPanel('detail');
        navigate(`/modules/nosql/documents/${doc.id}`);
    }, [navigate]);

    const handleBack = useCallback(() => {
        setPanel('list');
        setSelectedDoc(null);
        const cid = collectionId ?? selectedCollection?.id;
        if (cid) navigate(`/modules/nosql/collections/${cid}`);
    }, [collectionId, selectedCollection, navigate]);

    const handleShowVersions = useCallback(() => {
        setPanel('versions');
    }, []);

    const handleRestored = useCallback(() => {
        setPanel('detail');
    }, []);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Top bar */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
            }}>
                <button
                    onClick={() => navigate('/modules/nosql')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted-foreground, #6b7280)', padding: 0 }}
                >
                    ←
                </button>
                <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                }}>
                    🗄️
                </div>
                <div>
                    <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                        {selectedCollection?.name ?? 'NoSQL Collections'}
                    </h1>
                    {selectedCollection?.description && (
                        <p style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                            {selectedCollection.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Body: sidebar + main content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Collection tree sidebar */}
                <div style={{
                    width: 240,
                    borderRight: '1px solid var(--border, #e5e7eb)',
                    overflow: 'auto',
                    flexShrink: 0,
                    padding: '8px 0',
                }}>
                    <CollectionBrowser
                        selectedId={collectionId ?? selectedCollection?.id}
                        onSelect={handleCollectionSelect}
                    />
                </div>

                {/* Main panel */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {!collectionId && !documentId && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground, #6b7280)', fontSize: 14 }}>
                            Select a collection on the left to browse documents.
                        </div>
                    )}

                    {(collectionId ?? selectedCollection?.id) && panel === 'list' && (
                        <DocumentList
                            collectionId={(collectionId ?? selectedCollection?.id)!}
                            collectionName={selectedCollection?.name}
                            onSelect={handleDocSelect}
                            getDocumentHref={(doc) => `/modules/nosql/documents/${doc.id}`}
                        />
                    )}

                    {(collectionId ?? documentId) && panel === 'detail' && selectedDoc && (
                        <DocumentDetail
                            documentId={selectedDoc.id}
                            onBack={handleBack}
                            onShowVersions={handleShowVersions}
                        />
                    )}

                    {(collectionId ?? documentId) && panel === 'versions' && selectedDoc && (
                        <VersionHistory
                            documentId={selectedDoc.id}
                            currentVersion={selectedDoc.version}
                            onBack={() => setPanel('detail')}
                            onRestored={handleRestored}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
