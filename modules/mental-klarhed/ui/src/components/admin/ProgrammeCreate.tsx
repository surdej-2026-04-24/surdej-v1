import { useState } from 'react';
import { useMentalKlarhedApi } from '../../hooks/useMentalKlarhedApi.js';

interface Props {
    onCreated?: (programmeId: string) => void;
    onCancel?: () => void;
}

export function ProgrammeCreate({ onCreated, onCancel }: Props) {
    const api = useMentalKlarhedApi();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [locale, setLocale] = useState<'da' | 'en'>('da');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const res = await api.createProgramme({ client: { name, email, locale } });
            onCreated?.(res.programmeId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Noget gik galt');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Nyt Mental Klarhed-forløb</h2>
            <p className="text-sm text-muted-foreground mb-6">
                Udfyld klientens oplysninger. Der sendes automatisk et velkomst-link til klientens e-mail.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="text-destructive text-sm p-3 bg-destructive/10 rounded">{error}</div>}
                <div className="space-y-1">
                    <label className="text-sm font-medium">Navn</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Klientens fulde navn"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">E-mail</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="klient@eksempel.dk"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">Sprog</label>
                    <select
                        value={locale}
                        onChange={e => setLocale(e.target.value as 'da' | 'en')}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                        <option value="da">Dansk</option>
                        <option value="en">English</option>
                    </select>
                </div>
                <div className="flex gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? 'Opretter...' : 'Opret forløb + send velkomst'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
                    >
                        Annullér
                    </button>
                </div>
            </form>
        </div>
    );
}
