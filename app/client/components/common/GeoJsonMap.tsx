import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_ENTRYPOINT ?? "http://localhost:8080")
    : "";

// Max features rendered per zoom tier
const ZOOM_LIMITS: Array<{ maxZoom: number; max: number }> = [
  { maxZoom: 5,        max: 300 },
  { maxZoom: 9,        max: 1000 },
  { maxZoom: 13,       max: 3000 },
  { maxZoom: Infinity, max: Infinity },
];

function limitForZoom(zoom: number): number {
  return ZOOM_LIMITS.find((t) => zoom <= t.maxZoom)!.max;
}

// Returns representative [lng, lat] for a feature (GeoJSON axis order)
function featurePoint(feature: any): [number, number] | null {
  const { type, coordinates: c } = feature?.geometry ?? {};
  if (!c) return null;
  switch (type) {
    case "Point":            return c;
    case "MultiPoint":
    case "LineString":       return c[0];
    case "MultiLineString":
    case "Polygon":          return c[0][0];
    case "MultiPolygon":     return c[0][0][0];
    default:                 return null;
  }
}

function selectFeatures(
  all: any[],
  zoom: number,
  bounds: L.LatLngBounds
): { shown: any[]; total: number } {
  const total = all.length;
  const limit = limitForZoom(zoom);

  if (total <= 1000 && limit === Infinity) return { shown: all, total };

  // Expand bounds slightly so features at the edge aren't clipped
  const dLng = (bounds.getEast() - bounds.getWest()) * 0.1;
  const dLat = (bounds.getNorth() - bounds.getSouth()) * 0.1;
  const w = bounds.getWest() - dLng, e = bounds.getEast() + dLng;
  const s = bounds.getSouth() - dLat, n = bounds.getNorth() + dLat;

  const inView = all.filter((f) => {
    const p = featurePoint(f);
    if (!p) return true; // unknown geometry — include it
    return p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n;
  });

  if (limit === Infinity || inView.length <= limit) return { shown: inView, total };

  // Uniform spatial sample down to limit
  const step = inView.length / limit;
  const shown = Array.from({ length: limit }, (_, i) => inView[Math.floor(i * step)]);
  return { shown, total };
}

// ---- sub-components (must be inside MapContainer) ----

function FitBounds({ features }: { features: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (!features.length) return;
    try {
      const bounds = L.geoJSON({ type: "FeatureCollection", features } as any).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fit once on mount
  return null;
}

function DynamicLayer({
  features,
  onCount,
}: {
  features: any[];
  onCount: (shown: number, total: number) => void;
}) {
  const map = useMap();
  // Use refs so the event handler closure is always fresh without re-registering
  const featuresRef = useRef(features);
  const onCountRef = useRef(onCount);
  featuresRef.current = features;
  onCountRef.current = onCount;

  useEffect(() => {
    // Canvas renderer is significantly faster than SVG for large feature sets
    const layer = L.geoJSON(undefined, { renderer: L.canvas() });
    layer.addTo(map);

    const refresh = () => {
      const { shown, total } = selectFeatures(
        featuresRef.current,
        map.getZoom(),
        map.getBounds()
      );
      layer.clearLayers();
      if (shown.length) {
        layer.addData({ type: "FeatureCollection", features: shown } as any);
      }
      onCountRef.current(shown.length, total);
    };

    map.on("zoomend moveend", refresh);
    refresh();

    return () => {
      map.off("zoomend moveend", refresh);
      map.removeLayer(layer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]); // layer lifetime tied to map instance

  return null;
}

// ---- main component ----

interface Props {
  content: string;
}

const GeoJsonMap = ({ content }: Props) => {
  const [features, setFeatures] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ shown: number; total: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setFeatures(null);
    setCounts(null);

    const ingest = (json: any) => {
      const feats: any[] =
        json?.features ?? (json?.type === "Feature" ? [json] : null);
      if (!Array.isArray(feats)) throw new Error("Not a valid GeoJSON FeatureCollection.");
      setFeatures(feats);
      setLoading(false);
    };

    if (content.startsWith("{") || content.startsWith("[")) {
      try { ingest(JSON.parse(content)); } catch { setError("Invalid GeoJSON content."); setLoading(false); }
      return;
    }

    if (content.startsWith("/geojson/")) {
      fetch(BASE + content)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(ingest)
        .catch((e) => { setError("Could not load GeoJSON: " + e.message); setLoading(false); });
      return;
    }

    setLoading(false);
  }, [content]);

  if (!content.startsWith("/geojson/") && !content.startsWith("{") && !content.startsWith("[")) {
    return null;
  }

  return (
    <div className="map-wrapper">
      {loading && <div className="map-loading">Loading map…</div>}
      {error && <div className="map-error">{error}</div>}
      {!loading && !error && features && (
        <>
          {counts && counts.shown < counts.total && (
            <div className="map-hint">
              Showing {counts.shown.toLocaleString()} of {counts.total.toLocaleString()} features — zoom in or pan to see more
            </div>
          )}
          <MapContainer
            center={[20, 0]}
            zoom={2}
            scrollWheelZoom={true}
            style={{ height: "450px", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <DynamicLayer features={features} onCount={(shown, total) => setCounts({ shown, total })} />
            <FitBounds features={features} />
          </MapContainer>
        </>
      )}
    </div>
  );
};

export default GeoJsonMap;
