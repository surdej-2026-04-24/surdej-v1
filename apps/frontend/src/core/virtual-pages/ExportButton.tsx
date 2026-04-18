/**
 * Export Button
 *
 * Triggers YAML export for a skin or a single virtual page.
 * Downloads the result as a .yaml file.
 */

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { exportSkin, exportVirtualPage, downloadYaml } from '@/services/virtualPageApi';

interface ExportButtonProps {
    /** Export mode */
    mode: 'skin' | 'page';
    skinId: string;
    pageId?: string;
    pageSlug?: string;
    skinName?: string;
    /** Button variant */
    variant?: 'default' | 'outline' | 'ghost' | 'secondary';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
}

export function ExportButton({
    mode,
    skinId,
    pageId,
    pageSlug,
    skinName,
    variant = 'outline',
    size = 'sm',
    className,
}: ExportButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleExport = useCallback(async () => {
        setLoading(true);
        try {
            if (mode === 'skin') {
                const yaml = await exportSkin(skinId);
                const name = skinName?.toLowerCase().replace(/\s+/g, '-') || 'skin';
                downloadYaml(yaml, `${name}.yaml`);
            } else if (mode === 'page' && pageId) {
                const yaml = await exportVirtualPage(skinId, pageId);
                downloadYaml(yaml, `${pageSlug || 'page'}.yaml`);
            }
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setLoading(false);
        }
    }, [mode, skinId, pageId, pageSlug, skinName]);

    return (
        <Button variant={variant} size={size} onClick={handleExport} disabled={loading} className={className}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            <span className="ml-1.5">Export</span>
        </Button>
    );
}
