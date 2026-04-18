/**
 * Language Switcher — compact dropdown for switching between en/da.
 *
 * Designed to be placed in the settings page, header, or accessibility page.
 */

import { useTranslation, SUPPORTED_LOCALES, type Locale } from '@/core/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Languages, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function LanguageSwitcher({ className }: { className?: string }) {
    const { locale, setLocale } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const current = SUPPORTED_LOCALES.find((l) => l.code === locale)!;

    return (
        <div ref={ref} className={cn('relative inline-block', className)}>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(!open)}
            >
                <Languages className="h-4 w-4" />
            </Button>

            {open && (
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border bg-popover shadow-lg animate-fade-in">
                    {SUPPORTED_LOCALES.map((loc) => (
                        <button
                            key={loc.code}
                            className={cn(
                                'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent',
                                loc.code === locale && 'bg-accent/50 font-medium',
                                'first:rounded-t-lg last:rounded-b-lg',
                            )}
                            onClick={() => {
                                setLocale(loc.code as Locale);
                                setOpen(false);
                            }}
                        >
                            <span className="flex-1 text-left">{loc.nativeLabel}</span>
                            {loc.code === locale && (
                                <Check className="h-4 w-4 text-primary" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
