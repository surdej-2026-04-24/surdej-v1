import { getGraphToken } from './auth';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function graphFetch<T>(path: string): Promise<T> {
    const token = await getGraphToken();
    const res = await fetch(`${GRAPH_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Graph ${res.status}: ${text}`);
    }
    return res.json();
}

// ─── Types ──────────────────────────────────────────────────────

export interface GraphSite {
    id: string;
    displayName: string;
    webUrl: string;
    name: string;
}

export interface GraphList {
    id: string;
    displayName: string;
    webUrl: string;
    list?: {
        template: string;
    };
}

export interface DriveItem {
    id: string;
    name: string;
    webUrl: string;
    size?: number;
    folder?: { childCount: number };
    file?: { mimeType: string };
    lastModifiedDateTime: string;
    lastModifiedBy?: {
        user?: { displayName: string };
    };
}

// ─── API ────────────────────────────────────────────────────────

export async function searchSites(query: string): Promise<GraphSite[]> {
    const data = await graphFetch<{ value: GraphSite[] }>(
        `/sites?search=${encodeURIComponent(query)}&$top=20`,
    );
    return data.value;
}

export async function getSiteLibraries(siteId: string): Promise<GraphList[]> {
    const data = await graphFetch<{ value: GraphList[] }>(
        `/sites/${siteId}/drives`,
    );
    return data.value;
}

export async function getDriveChildren(
    siteId: string,
    driveId: string,
    folderId?: string,
): Promise<DriveItem[]> {
    const path = folderId
        ? `/sites/${siteId}/drives/${driveId}/items/${folderId}/children`
        : `/sites/${siteId}/drives/${driveId}/root/children`;
    const data = await graphFetch<{ value: DriveItem[] }>(
        `${path}?$orderby=name&$top=100`,
    );
    return data.value;
}
