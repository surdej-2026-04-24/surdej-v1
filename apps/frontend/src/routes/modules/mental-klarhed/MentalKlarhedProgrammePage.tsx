import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ProgrammeDetail, MaterialReview } from '@surdej/module-mental-klarhed-ui';

type View = 'detail' | { material: { sessionNumber: number } };

export function MentalKlarhedProgrammePage() {
    const navigate = useNavigate();
    const { programmeId } = useParams<{ programmeId: string }>();
    const [view, setView] = useState<View>('detail');

    const handleBack = useCallback(() => navigate('/modules/mental-klarhed'), [navigate]);

    if (!programmeId) return null;

    if (typeof view === 'object' && 'material' in view) {
        return (
            <MaterialReview
                programmeId={programmeId}
                sessionNumber={view.material.sessionNumber}
                onBack={() => setView('detail')}
            />
        );
    }

    return (
        <ProgrammeDetail
            programmeId={programmeId}
            onBack={handleBack}
            onShowMaterial={(sessionNumber) => setView({ material: { sessionNumber } })}
        />
    );
}
