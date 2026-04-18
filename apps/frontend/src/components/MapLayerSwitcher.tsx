/**
 * MapLayerSwitcher — Tile layer switch + Google Traffic overlay for Leaflet
 *
 * Provides:
 *   - Multiple base layers (OSM Light, Google Roadmap, Satellite, Hybrid)
 *   - Google Traffic overlay toggle
 *   - Compact floating control panel
 *
 * Uses react-leaflet's useMap() — must be rendered inside <MapContainer>.
 */

import { useEffect, useState, useCallback } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Layers, Car } from 'lucide-react';
import { config } from '@/config';

export type MapLayerId = 'osm-light' | 'osm-dark' | 'osm-voyager' | 'osm-watercolor' | 'google-roadmap' | 'google-satellite' | 'google-hybrid';

interface LayerDef {
    id: MapLayerId;
    label: string;
    url: string;
    attribution: string;
    maxZoom?: number;
    group?: 'osm' | 'google';
}

const GOOGLE_KEY = config.googleMapsApiKey;
const STADIA_KEY = config.stadiaMapsApiKey;

const LAYERS: LayerDef[] = [
    {
        id: 'osm-light',
        label: 'Lyst',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
        group: 'osm',
    },
    {
        id: 'osm-dark',
        label: 'Mørkt',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
        group: 'osm',
    },
    {
        id: 'osm-voyager',
        label: 'Voyager',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
        group: 'osm',
    },
    {
        id: 'osm-watercolor',
        label: 'Akvarel',
        url: STADIA_KEY
            ? `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${STADIA_KEY}`
            : 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
        attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 16,
        group: 'osm',
    },
    {
        id: 'google-roadmap',
        label: 'Google',
        url: `https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m3!1e0!2sm!3i{r}!3m9!2sda!3sDK!5e18!12m1!1e68!12m3!1e37!2m1!1ssmartmaps&key=${GOOGLE_KEY}`,
        attribution: '&copy; Google',
        maxZoom: 21,
        group: 'google',
    },
    {
        id: 'google-satellite',
        label: 'Satellit',
        url: `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${GOOGLE_KEY}`,
        attribution: '&copy; Google',
        maxZoom: 21,
        group: 'google',
    },
    {
        id: 'google-hybrid',
        label: 'Hybrid',
        url: `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${GOOGLE_KEY}`,
        attribution: '&copy; Google',
        maxZoom: 21,
        group: 'google',
    },
];

const TRAFFIC_URL = `https://mt1.google.com/vt/lyrs=h@221097413,traffic&x={x}&y={y}&z={z}&key=${GOOGLE_KEY}`;

// ─── Traffic Layer Manager (imperative Leaflet layer) ───
function TrafficLayerManager({ enabled }: { enabled: boolean }) {
    const map = useMap();

    useEffect(() => {
        if (!enabled || !GOOGLE_KEY) return;
        const layer = L.tileLayer(TRAFFIC_URL, {
            maxZoom: 21,
            opacity: 0.7,
            zIndex: 500,
        });
        layer.addTo(map);
        return () => { map.removeLayer(layer); };
    }, [enabled, map]);

    return null;
}

// ─── Main Component ───
interface MapLayerSwitcherProps {
    /** Default active layer */
    defaultLayer?: MapLayerId;
    /** Show traffic toggle (requires Google Maps API key) */
    showTraffic?: boolean;
    /** Position of the control */
    position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
    /** Hide the UI controls (keep tile layer rendering) */
    hideControls?: boolean;
    /** Controlled layer (overrides internal state) */
    layer?: MapLayerId;
    /** Callback when layer changes (controlled mode) */
    onLayerChange?: (id: MapLayerId) => void;
    /** Controlled traffic state */
    traffic?: boolean;
    /** Callback when traffic toggle changes */
    onTrafficChange?: (on: boolean) => void;
}

/** Expose layers and Google key availability for external UIs */
export const MAP_LAYERS = LAYERS;
export const GOOGLE_KEY_AVAILABLE = !!GOOGLE_KEY;
export const STADIA_KEY_AVAILABLE = !!STADIA_KEY;

export function MapLayerSwitcher({
    defaultLayer = 'osm-light',
    showTraffic = true,
    position = 'topright',
    hideControls = false,
    layer: controlledLayer,
    onLayerChange,
    traffic: controlledTraffic,
    onTrafficChange,
}: MapLayerSwitcherProps) {
    const [internalLayer, setInternalLayer] = useState<MapLayerId>(defaultLayer);
    const [internalTraffic, setInternalTraffic] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);

    const activeLayer = controlledLayer ?? internalLayer;
    const trafficOn = controlledTraffic ?? internalTraffic;

    const layerDef = LAYERS.find(l => l.id === activeLayer) || LAYERS[0];

    const handleLayerChange = useCallback((id: MapLayerId) => {
        if (onLayerChange) {
            onLayerChange(id);
        } else {
            setInternalLayer(id);
        }
        setPanelOpen(false);
    }, [onLayerChange]);

    // Positioning styles
    const posStyles: React.CSSProperties = {
        position: 'absolute',
        zIndex: 1000,
        ...(position.includes('top') ? { top: 10 } : { bottom: 70 }),
        ...(position.includes('right') ? { right: 10 } : { left: 60 }),
    };

    const hasGoogleKey = !!GOOGLE_KEY;

    return (
        <>
            {/* Active tile layer */}
            <TileLayer
                crossOrigin="anonymous"
                key={layerDef.id}
                url={layerDef.url}
                attribution={layerDef.attribution}
                maxZoom={layerDef.maxZoom || 20}
            />

            {/* Traffic overlay */}
            <TrafficLayerManager enabled={trafficOn && hasGoogleKey} />

            {/* Floating control — hidden when hideControls is true */}
            {!hideControls && (
                <div style={posStyles} className="pointer-events-auto">
                    <div className="flex flex-col gap-1.5 items-end">
                        {/* Layer button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setPanelOpen(!panelOpen); }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
                            title="Skift kortlag"
                        >
                            <Layers className="h-4 w-4" />
                            {layerDef.label}
                        </button>

                        {/* Traffic toggle */}
                        {showTraffic && hasGoogleKey && (
                            <button
                                onClick={(e) => { e.stopPropagation(); if (onTrafficChange) { onTrafficChange(!trafficOn); } else { setInternalTraffic(!trafficOn); } }}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-lg border transition-colors text-sm font-medium ${trafficOn
                                    ? 'bg-green-500 border-green-600 text-white hover:bg-green-600'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                                title="Vis trafiklag"
                            >
                                <Car className="h-4 w-4" />
                                Trafik
                            </button>
                        )}

                        {/* Layer picker panel */}
                        {panelOpen && (
                            <div className="mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden w-48">
                                {/* OSM group */}
                                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700">
                                    OpenStreetMap
                                </div>
                                {LAYERS.filter(l => l.group === 'osm').map(l => {
                                    const isDisabled = l.id === 'osm-watercolor' && !STADIA_KEY;
                                    return (
                                        <div key={l.id} className="relative group">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (!isDisabled) handleLayerChange(l.id); }}
                                                disabled={isDisabled}
                                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                                    isDisabled
                                                        ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                                        : activeLayer === l.id
                                                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {l.label}
                                            </button>
                                            {isDisabled && (
                                                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block z-50">
                                                    <div className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 w-44 shadow-lg">
                                                        Kræver Stadia Maps API-nøgle. Tilføj <code className="font-mono">VITE_STADIA_MAPS_API_KEY</code> til .env.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Google group */}
                                {hasGoogleKey && (
                                    <>
                                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-t border-b border-slate-100 dark:border-slate-700">
                                            Google Maps
                                        </div>
                                        {LAYERS.filter(l => l.group === 'google').map(l => (
                                            <button
                                                key={l.id}
                                                onClick={(e) => { e.stopPropagation(); handleLayerChange(l.id); }}
                                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${activeLayer === l.id
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {l.label}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
