import { useParams } from 'react-router';
import { LivshjuletForm } from '@surdej/module-mental-klarhed-ui';

/**
 * Shown after the client clicks their magic-link and lands on the assessment page.
 * The worker's /k/:token route sets the JWT cookie and redirects here.
 */
export function MentalKlarhedAssessmentPage() {
    const { sessionId } = useParams<{ sessionId: string }>();

    if (!sessionId) {
        return (
            <div className="p-6 text-destructive">
                Ugyldigt session-link. Kontakt Asger for et nyt link.
            </div>
        );
    }

    return (
        <LivshjuletForm
            sessionId={sessionId}
            sessionNumber={0}  // Will be resolved by API on submit
            isFinal={false}
            locale="da"
            onCompleted={() => {
                window.location.href = '/mental-klarhed/portal';
            }}
        />
    );
}
