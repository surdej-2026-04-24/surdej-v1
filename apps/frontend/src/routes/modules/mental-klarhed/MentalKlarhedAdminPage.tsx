import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ProgrammeList, ProgrammeCreate } from '@surdej/module-mental-klarhed-ui';

type View = 'list' | 'create';

export function MentalKlarhedAdminPage() {
    const navigate = useNavigate();
    const [view, setView] = useState<View>('list');

    const handleSelect = useCallback((programmeId: string) => {
        navigate(`/modules/mental-klarhed/programmes/${programmeId}`);
    }, [navigate]);

    if (view === 'create') {
        return (
            <ProgrammeCreate
                onCreated={(id) => {
                    setView('list');
                    navigate(`/modules/mental-klarhed/programmes/${id}`);
                }}
                onCancel={() => setView('list')}
            />
        );
    }

    return (
        <ProgrammeList
            onSelect={handleSelect}
            onCreate={() => setView('create')}
        />
    );
}
