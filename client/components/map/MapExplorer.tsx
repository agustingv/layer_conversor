import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { fetch as apiFetch } from "../../utils/dataAccess";
import { Project } from "../../types/Project";
import { LayerGroup } from "../../types/LayerGroup";
import { Layer } from "../../types/Layer";
import { PagedCollection } from "../../types/collection";

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

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f97316",
  "#a855f7", "#14b8a6", "#f59e0b", "#ec4899",
  "#06b6d4", "#84cc16",
];

// ─── types ────────────────────────────────────────────────────────────────────

type LayerStatus = "pending" | "loading" | "loaded" | "skipped";

interface Extent { xmin: number; ymin: number; xmax: number; ymax: number; }

interface ManagedLayer {
  id: string;
  name: string;
  color: string;
  geoJsonPath: string;
  extent?: Extent;
  status: LayerStatus;
  features: any[];
}

// ─── spatial helpers ──────────────────────────────────────────────────────────

function extentIntersects(bounds: L.LatLngBounds, ext: Extent): boolean {
  // ext uses GeoJSON axis order: xmin/xmax = lng, ymin/ymax = lat
  return (
    ext.xmax >= bounds.getWest() &&
    ext.xmin <= bounds.getEast() &&
    ext.ymax >= bounds.getSouth() &&
    ext.ymin <= bounds.getNorth()
  );
}

function distToCenter(ext: Extent, center: L.LatLng): number {
  return Math.hypot(
    (ext.xmin + ext.xmax) / 2 - center.lng,
    (ext.ymin + ext.ymax) / 2 - center.lat,
  );
}

// ─── map sub-components (must be rendered inside MapContainer) ─────────────

// Captures the Leaflet map instance into a ref owned by the parent
function MapRefCapture({ onMap }: { onMap: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

// Renders one GeoJSON layer; removes it on unmount
function LayerRenderer({ features, color }: { features: any[]; color: string }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.geoJSON(undefined, {
      renderer: L.canvas(),
      style: () => ({ color, weight: 2, fillColor: color, fillOpacity: 0.25 }),
      pointToLayer: (_f, latlng) =>
        L.circleMarker(latlng, {
          renderer: L.canvas(),
          radius: 5,
          color,
          fillColor: color,
          fillOpacity: 0.7,
          weight: 1.5,
        }),
    });
    layer.addTo(map);
    layer.addData({ type: "FeatureCollection", features } as any);
    return () => { map.removeLayer(layer); };
  }, [map, features, color]);
  return null;
}

// Fits the map to the first loaded layer exactly once per resetKey,
// then calls onFitted so the parent can activate viewport streaming.
function FitOnFirstLoaded({
  layers,
  resetKey,
  onFitted,
}: {
  layers: ManagedLayer[];
  resetKey: string;
  onFitted: () => void;
}) {
  const map = useMap();
  const fitted = useRef(false);
  const prevKey = useRef("");

  // Reset when project/group changes
  if (prevKey.current !== resetKey) {
    prevKey.current = resetKey;
    fitted.current = false;
  }

  const firstLoaded = layers.find(
    (l) => l.status === "loaded" && l.features.length > 0
  );

  useEffect(() => {
    if (fitted.current || !firstLoaded) return;
    fitted.current = true;
    try {
      const bounds = L.geoJSON({
        type: "FeatureCollection",
        features: firstLoaded.features,
      } as any).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [32, 32] });
        onFitted();
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!firstLoaded]);

  return null;
}

// After the initial fit, loads pending layers whose extents enter the viewport.
function ViewportLoader({
  layers,
  onLoadVisible,
}: {
  layers: ManagedLayer[];
  onLoadVisible: (ids: string[]) => void;
}) {
  const map = useMap();
  const layersRef = useRef(layers);
  const onLoadRef = useRef(onLoadVisible);
  layersRef.current = layers;
  onLoadRef.current = onLoadVisible;

  const checkViewport = useCallback(() => {
    const bounds = map.getBounds();
    const toLoad = layersRef.current
      .filter((l) => l.status === "pending" && l.extent)
      .filter((l) => extentIntersects(bounds, l.extent!))
      .map((l) => l.id);
    if (toLoad.length > 0) onLoadRef.current(toLoad);
  }, [map]);

  // Re-check when pending layers change (e.g., first fit zoomed us in)
  const pendingKey = layers
    .filter((l) => l.status === "pending" && l.extent)
    .map((l) => l.id)
    .join(",");

  useEffect(() => {
    if (pendingKey) checkViewport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  // Check on every map move / zoom
  useEffect(() => {
    map.on("zoomend moveend", checkViewport);
    return () => { map.off("zoomend moveend", checkViewport); };
  }, [map, checkViewport]);

  return null;
}

// ─── main component ────────────────────────────────────────────────────────

const MapExplorer = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<LayerGroup[]>([]);
  const [projectIri, setProjectIri] = useState("");
  const [groupIri, setGroupIri] = useState("");
  const [layers, setLayers] = useState<ManagedLayer[]>([]);
  const [fetchingList, setFetchingList] = useState(false);
  const [streamingActive, setStreamingActive] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<ManagedLayer[]>([]);
  const loadingIds = useRef(new Set<string>());
  layersRef.current = layers;

  const handleMapReady = useCallback((m: L.Map) => { mapRef.current = m; }, []);

  // ── fetch GeoJSON for the given layer IDs ──────────────────────────────────
  // `source` must be passed when called right after setLayers() in the same
  // async callback — at that point layersRef.current is still stale (React
  // hasn't re-rendered yet, so the ref holds the previous state).
  // For viewport-triggered calls layersRef is fresh and no source is needed.
  const loadLayerGeoJsons = useCallback(async (
    ids: string[],
    source?: ManagedLayer[],
  ) => {
    const toFetch = ids.filter((id) => !loadingIds.current.has(id));
    if (!toFetch.length) return;

    // Resolve geoJsonPath SYNCHRONOUSLY before any await, using source when
    // the ref may be stale.  The inner async bodies never touch layersRef.
    const pathMap = new Map<string, string>();
    for (const id of toFetch) {
      const layer =
        source?.find((l) => l.id === id) ??
        layersRef.current.find((l) => l.id === id);
      if (layer?.geoJsonPath) pathMap.set(id, layer.geoJsonPath);
    }

    toFetch.forEach((id) => loadingIds.current.add(id));
    setLayers((prev) =>
      prev.map((l) =>
        toFetch.includes(l.id) && l.status === "pending"
          ? { ...l, status: "loading" }
          : l
      )
    );

    await Promise.all(
      toFetch.map(async (id) => {
        const geoJsonPath = pathMap.get(id);
        if (!geoJsonPath) { loadingIds.current.delete(id); return; }
        try {
          const r = await window.fetch(BASE + geoJsonPath);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const json = await r.json();
          setLayers((prev) =>
            prev.map((l) =>
              l.id === id
                ? { ...l, status: "loaded", features: json.features ?? [] }
                : l
            )
          );
        } catch {
          setLayers((prev) =>
            prev.map((l) => (l.id === id ? { ...l, status: "pending" } : l))
          );
        } finally {
          loadingIds.current.delete(id);
        }
      })
    );
  }, []);

  const handleLoadVisible = useCallback(
    (ids: string[]) => { loadLayerGeoJsons(ids); },
    [loadLayerGeoJsons]
  );

  // ── projects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<PagedCollection<Project>>("/projects?pagination=false")
      .then((res) => setProjects(res?.data.member ?? []))
      .catch(() => {});
  }, []);

  // ── groups ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setGroupIri("");
    setGroups([]);
    if (!projectIri) return;
    apiFetch<PagedCollection<LayerGroup>>(
      `/layer_groups?project=${encodeURIComponent(projectIri)}&pagination=false`
    )
      .then((res) => setGroups(res?.data.member ?? []))
      .catch(() => {});
  }, [projectIri]);

  // ── layers: fetch list, sort by proximity, kick off first load ─────────────
  useEffect(() => {
    loadingIds.current.clear();
    setLayers([]);
    setStreamingActive(false);
    if (!projectIri) return;

    let cancelled = false;
    setFetchingList(true);

    const qs = new URLSearchParams({ pagination: "false" });
    qs.set("project", projectIri);
    if (groupIri) qs.set("group", groupIri);

    apiFetch<PagedCollection<Layer>>(`/layers?${qs}`)
      .then((res) => {
        if (cancelled) return;

        const apiLayers = (res?.data.member ?? []).filter(
          (l) => l.conversionStatus === "done" && l.geoJsonPath
        );

        const center = mapRef.current?.getCenter() ?? L.latLng(20, 0);

        // Sort: layers with known extents first, ordered by distance to map center.
        // Layers without extents come last (we can't tell where they are).
        const sorted = [...apiLayers].sort((a, b) => {
          const ea = a.metadata?.extent;
          const eb = b.metadata?.extent;
          if (!ea && !eb) return 0;
          if (!ea) return 1;
          if (!eb) return -1;
          return distToCenter(ea, center) - distToCenter(eb, center);
        });

        let colorIdx = 0;
        const managed: ManagedLayer[] = sorted.map((l) => {
          const skipped = (l.metadata?.geoJsonSize ?? 0) > 5_000_000;
          const color = skipped ? "#9ca3af" : COLORS[colorIdx % COLORS.length];
          if (!skipped) colorIdx++;
          return {
            id: l["@id"]!,
            name: l.name ?? "Layer",
            color,
            geoJsonPath: l.geoJsonPath!,
            extent: l.metadata?.extent,
            status: skipped ? "skipped" : "pending",
            features: [],
          };
        });

        setLayers(managed);
        setFetchingList(false);

        // Load the closest layer immediately; also load any that have no extent
        // info (we can't do viewport-based deferred loading for those).
        const pending = managed.filter((l) => l.status === "pending");
        const first = pending.find((l) => l.extent) ?? pending[0];
        const noExtent = pending.filter((l) => !l.extent && l !== first);
        const immediateIds = [
          ...(first ? [first.id] : []),
          ...noExtent.map((l) => l.id),
        ];
        if (immediateIds.length) loadLayerGeoJsons(immediateIds, managed);
      })
      .catch(() => { if (!cancelled) setFetchingList(false); });

    return () => { cancelled = true; };
  }, [projectIri, groupIri, loadLayerGeoJsons]);

  // ── derived state ──────────────────────────────────────────────────────────
  const resetKey = projectIri + "|" + groupIri;
  const loadedLayers = layers.filter((l) => l.status === "loaded");
  const skippedLayers = layers.filter((l) => l.status === "skipped");
  const inFlight = layers.filter(
    (l) => l.status === "pending" || l.status === "loading"
  ).length;
  const totalFeatures = loadedLayers.reduce((s, l) => s + l.features.length, 0);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="map-explorer">
      <aside className="map-explorer-sidebar">
        <div className="map-explorer-sidebar-inner">

          <h2 className="map-explorer-section-title">Filters</h2>

          <label className="map-explorer-label">Project</label>
          <select
            className="map-explorer-select"
            value={projectIri}
            onChange={(e) => setProjectIri(e.target.value)}
          >
            <option value="">— Select project —</option>
            {projects.map((p) => (
              <option key={p["@id"]} value={p["@id"]}>{p.name}</option>
            ))}
          </select>

          <label className="map-explorer-label">Group</label>
          <select
            className="map-explorer-select"
            value={groupIri}
            onChange={(e) => setGroupIri(e.target.value)}
            disabled={!projectIri}
          >
            <option value="">— All groups —</option>
            {groups.map((g) => (
              <option key={g["@id"]} value={g["@id"]}>{g.name}</option>
            ))}
          </select>

          {!projectIri && (
            <p className="map-explorer-hint">Select a project to explore its layers.</p>
          )}

          {fetchingList && (
            <p className="map-explorer-status">Fetching layer list…</p>
          )}

          {!fetchingList && projectIri && layers.length === 0 && (
            <p className="map-explorer-hint">No converted layers found.</p>
          )}

          {inFlight > 0 && (
            <p className="map-explorer-status">
              Loading {inFlight} layer{inFlight !== 1 ? "s" : ""}…
            </p>
          )}

          {loadedLayers.length > 0 && (
            <>
              <h2 className="map-explorer-section-title" style={{ marginTop: "1.25rem" }}>
                Layers — {totalFeatures.toLocaleString()} features
              </h2>
              <ul className="map-explorer-legend">
                {loadedLayers.map((l) => (
                  <li key={l.id} className="map-explorer-legend-item">
                    <span className="map-explorer-legend-dot" style={{ background: l.color }} />
                    <span className="map-explorer-legend-name">{l.name}</span>
                    <span className="map-explorer-legend-count">
                      {l.features.length.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {skippedLayers.length > 0 && (
            <div className="map-explorer-skipped">
              <p className="map-explorer-skipped-title">
                Skipped — too large (&gt;5 MB):
              </p>
              <ul className="map-explorer-skipped-list">
                {skippedLayers.map((l) => (
                  <li key={l.id}>{l.name}</li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </aside>

      <div className="map-explorer-map">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapRefCapture onMap={handleMapReady} />
          {loadedLayers.map((l) => (
            <LayerRenderer key={l.id} features={l.features} color={l.color} />
          ))}
          <FitOnFirstLoaded
            layers={layers}
            resetKey={resetKey}
            onFitted={() => setStreamingActive(true)}
          />
          {streamingActive && (
            <ViewportLoader layers={layers} onLoadVisible={handleLoadVisible} />
          )}
        </MapContainer>

        {!projectIri && (
          <div className="map-explorer-overlay">
            Select a project in the sidebar to load its layers
          </div>
        )}
      </div>
    </div>
  );
};

export default MapExplorer;
