import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ChefHat, ArrowLeft, RefreshCw, Clock, Users, BookOpen, Refrigerator } from 'lucide-react';
import { loadFridgeItems, getExpiryStatus, type FridgeItem } from './fridgeStore';

// ─── Recipe data ──────────────────────────────────────────────────────────────
// In production this would call an AI endpoint. Here we use a static lookup
// keyed on ingredient names to generate relevant suggestions.

interface Recipe {
    id: string;
    title: string;
    description: string;
    prepTime: string;
    servings: number;
    difficulty: 'Let' | 'Mellem' | 'Svær';
    usesExpiring: boolean;
    usedIngredients: string[];
    steps: string[];
}

const RECIPE_BANK: Recipe[] = [
    {
        id: 'r1',
        title: 'Hurtig kyllingewok',
        description: 'En nem og lækker wok med kylling og grøntsager — perfekt til at bruge madvarer der nærmer sig udløbsdatoen.',
        prepTime: '20 min',
        servings: 2,
        difficulty: 'Let',
        usesExpiring: false,
        usedIngredients: ['kylling', 'gulerødder', 'løg'],
        steps: [
            'Skær kyllingen i mundrette stykker.',
            'Steg kyllingen i olie ved høj varme i 5 min.',
            'Tilsæt grøntsager og steg yderligere 5 min.',
            'Krydr med sojasovs, hvidløg og ingefær.',
            'Servér med ris eller nudler.',
        ],
    },
    {
        id: 'r2',
        title: 'Omelet med grøntsager',
        description: 'En hurtig omelet der udnytter rester fra køleskabet — god til morgenmad eller frokost.',
        prepTime: '10 min',
        servings: 1,
        difficulty: 'Let',
        usesExpiring: false,
        usedIngredients: ['æg', 'mælk', 'smør', 'grøntsager'],
        steps: [
            'Pisk æg og mælk sammen i en skål.',
            'Smelt smør i en stegepande.',
            'Hæld æggemassen på og lad det stivne.',
            'Tilsæt finthakkede grøntsager fra køleskabet.',
            'Fold omeletten og servér straks.',
        ],
    },
    {
        id: 'r3',
        title: 'Grøntsagssuppe',
        description: 'Brug alle grøntsager der nærmer sig udløb — kogt til en nærende suppe der varmer.',
        prepTime: '30 min',
        servings: 4,
        difficulty: 'Let',
        usesExpiring: true,
        usedIngredients: ['gulerødder', 'løg', 'selleri', 'kartofler'],
        steps: [
            'Hak alle grøntsager groft.',
            'Sauter løg og hvidløg i olie.',
            'Tilsæt resten af grøntsagerne og svits kort.',
            'Dæk med grøntsagsbouillon og lad simre 20 min.',
            'Blend delvist og krydr med salt, peber og friske urter.',
        ],
    },
    {
        id: 'r4',
        title: 'Pasta med flødesovs',
        description: 'Klassisk og hurtig aftensmad med ingredienser du sandsynligvis allerede har.',
        prepTime: '20 min',
        servings: 2,
        difficulty: 'Let',
        usesExpiring: false,
        usedIngredients: ['pasta', 'fløde', 'smør', 'parmesan'],
        steps: [
            'Kog pasta efter anvisning på pakken.',
            'Smelt smør i en gryde, tilsæt fløde.',
            'Lad sovsen reducere let og krydr med salt og peber.',
            'Bland pasta i sovsen og riv parmesan over.',
            'Servér straks med grøn salat.',
        ],
    },
    {
        id: 'r5',
        title: 'Smoothie af frugt',
        description: 'Brug moden frugt der nærmer sig sin bedste dato til en nærende og lækker smoothie.',
        prepTime: '5 min',
        servings: 2,
        difficulty: 'Let',
        usesExpiring: true,
        usedIngredients: ['frugt', 'mælk', 'yoghurt'],
        steps: [
            'Skær frugt i mindre stykker.',
            'Blend frugten med mælk eller yoghurt.',
            'Tilsæt honning efter smag.',
            'Servér iskold i store glas.',
        ],
    },
    {
        id: 'r6',
        title: 'Fiskefrikadeller',
        description: 'Klassiske danske fiskefrikadeller med frisk fisk og urter.',
        prepTime: '25 min',
        servings: 4,
        difficulty: 'Mellem',
        usesExpiring: true,
        usedIngredients: ['fisk', 'æg', 'løg', 'mel'],
        steps: [
            'Hak fisken fint i en foodprocessor.',
            'Bland med æg, hakkede løg, mel og krydderier.',
            'Form til frikadeller.',
            'Steg ved middel varme ca. 4 min på hver side.',
            'Servér med kartofler og remoulade.',
        ],
    },
    {
        id: 'r7',
        title: 'Franskbrød med pålæg',
        description: 'Enkel og hurtig frokost — brug brødet inden det bliver tørt.',
        prepTime: '5 min',
        servings: 1,
        difficulty: 'Let',
        usesExpiring: true,
        usedIngredients: ['brød', 'smør', 'pålæg'],
        steps: [
            'Skær brødet i skiver.',
            'Smør med smør.',
            'Læg pålæg efter smag.',
            'Pynt med agurk og tomater.',
        ],
    },
    {
        id: 'r8',
        title: 'Ærtesuppe med bacon',
        description: 'Varm og mættende suppe — ideel til kolde dage.',
        prepTime: '40 min',
        servings: 4,
        difficulty: 'Mellem',
        usesExpiring: false,
        usedIngredients: ['ærter', 'bacon', 'løg', 'gulerod'],
        steps: [
            'Udblød ærter natten over.',
            'Sauter bacon og løg.',
            'Tilsæt ærter, gulerødder og bouillon.',
            'Kog i 30 min til ærterne er møre.',
            'Blend delvist og krydr med salt og timian.',
        ],
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelevantRecipes(items: FridgeItem[]): Recipe[] {
    if (items.length === 0) return RECIPE_BANK.slice(0, 4);

    const names = items.map(i => i.name.toLowerCase());
    const hasExpiring = items.some(i => {
        const s = getExpiryStatus(i);
        return s === 'expiring-soon' || s === 'expired';
    });

    const scored = RECIPE_BANK.map(recipe => {
        let score = 0;
        for (const ing of recipe.usedIngredients) {
            if (names.some(n => n.includes(ing) || ing.includes(n.split(' ')[0]))) score += 2;
        }
        if (hasExpiring && recipe.usesExpiring) score += 3;
        return { recipe, score };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .map(s => s.recipe);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const secondaryBtnStyle: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 6,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'transparent', color: 'var(--foreground, #111)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RecipeSuggestionsPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<FridgeItem[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    const refresh = useCallback(() => {
        const loaded = loadFridgeItems();
        setItems(loaded);
        setRecipes(getRelevantRecipes(loaded));
        setExpanded(null);
        setShowAll(false);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const displayed = showAll ? recipes : recipes.slice(0, 4);
    const expiringItems = items.filter(i => {
        const s = getExpiryStatus(i);
        return s === 'expiring-soon' || s === 'expired';
    });

    const difficultyColor: Record<string, string> = {
        Let: '#16a34a',
        Mellem: '#d97706',
        Svær: '#dc2626',
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
                <button
                    onClick={() => navigate('/modules/food-tracker')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground, #6b7280)', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                    <ArrowLeft size={18} />
                </button>
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <ChefHat size={20} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Opskriftforslag</h1>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0 }}>
                        Baseret på indholdet i dit køleskab
                    </p>
                </div>
                <button onClick={refresh} style={secondaryBtnStyle}>
                    <RefreshCw size={13} /> Opdatér
                </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                {/* "Use expiring" banner */}
                {expiringItems.length > 0 && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 10, marginBottom: 20,
                        background: '#fef3c7', border: '1px solid #fcd34d',
                        display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13,
                    }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                        <div>
                            <strong>Brug disse inden de udløber: </strong>
                            {expiringItems.map(i => i.name).join(', ')}.
                            {' '}Opskrifterne nedenfor er udvalgt til at hjælpe dig med at bruge dem.
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {items.length === 0 && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 10, marginBottom: 20,
                        background: 'var(--muted, #f9fafb)', border: '1px solid var(--border, #e5e7eb)',
                        display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                        color: 'var(--muted-foreground, #6b7280)',
                    }}>
                        <Refrigerator size={18} />
                        Køleskabet er tomt — opskrifterne nedenfor er generelle forslag.
                        <button
                            onClick={() => navigate('/modules/food-tracker')}
                            style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #e5e7eb)', background: 'transparent', fontSize: 12, cursor: 'pointer' }}
                        >
                            Tilføj varer
                        </button>
                    </div>
                )}

                {/* Recipe grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {displayed.map(recipe => (
                        <div
                            key={recipe.id}
                            style={{
                                borderRadius: 12,
                                border: '1px solid var(--border, #e5e7eb)',
                                background: 'var(--background, #fff)',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Card header */}
                            <div style={{
                                padding: '14px 16px',
                                borderBottom: expanded === recipe.id ? '1px solid var(--border, #e5e7eb)' : 'none',
                                background: recipe.usesExpiring
                                    ? 'linear-gradient(135deg, #fef3c7, #fff)'
                                    : 'linear-gradient(135deg, #f0fdf4, #fff)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{recipe.title}</div>
                                        {recipe.usesExpiring && (
                                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#fef3c7', color: '#d97706', display: 'inline-block', marginBottom: 6 }}>
                                                ⚡ Brug snart udløbende
                                            </span>
                                        )}
                                        <p style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', margin: 0, lineHeight: 1.5 }}>
                                            {recipe.description}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: 'var(--muted-foreground, #6b7280)', alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Clock size={12} /> {recipe.prepTime}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Users size={12} /> {recipe.servings} pers.
                                    </span>
                                    <span style={{ fontWeight: 600, color: difficultyColor[recipe.difficulty] }}>
                                        {recipe.difficulty}
                                    </span>
                                </div>
                            </div>

                            {/* Expanded: steps */}
                            {expanded === recipe.id && (
                                <div style={{ padding: '12px 16px' }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 10px', color: 'var(--muted-foreground, #6b7280)' }}>
                                        INGREDIENSER DER BRUGES
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                                        {recipe.usedIngredients.map(ing => (
                                            <span key={ing} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12, background: 'var(--muted, #f3f4f6)', color: 'var(--foreground, #111)' }}>
                                                {ing}
                                            </span>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 10px', color: 'var(--muted-foreground, #6b7280)' }}>
                                        FREMGANGSMÅDE
                                    </p>
                                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                                        {recipe.steps.map((step, i) => (
                                            <li key={i} style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
                                                {step}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {/* Toggle button */}
                            <button
                                onClick={() => setExpanded(prev => prev === recipe.id ? null : recipe.id)}
                                style={{
                                    width: '100%', padding: '10px 16px',
                                    borderTop: '1px solid var(--border, #e5e7eb)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 12, fontWeight: 600,
                                    color: 'var(--primary, #6366f1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                }}
                            >
                                <BookOpen size={13} />
                                {expanded === recipe.id ? 'Skjul opskrift' : 'Se opskrift'}
                            </button>
                        </div>
                    ))}
                </div>

                {recipes.length > 4 && !showAll && (
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <button
                            onClick={() => setShowAll(true)}
                            style={secondaryBtnStyle}
                        >
                            Vis alle {recipes.length} opskrifter
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
