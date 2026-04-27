import { FunctionComponent, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMutation } from "react-query";
import FileDropzone from "../common/FileDropzone";
import { fetch, FetchError, FetchResponse, getItemPath } from "../../utils/dataAccess";
import { Layer } from "../../types/Layer";
import { Project } from "../../types/Project";
import { LayerGroup } from "../../types/LayerGroup";

interface Props { layer?: Layer; }
interface SaveParams { values: { name: string; description: string; project: string; group: string }; file: File | null; id?: string; }

const ACCEPTED_EXTENSIONS = ".geojson,.json,.kml,.kmz,.gpx,.gml,.zip,.gpkg,.dgn,.dxf";

const SUPPORTED_FORMATS = [
  { label: "GeoJSON", exts: [".geojson", ".json"] },
  { label: "KML / KMZ", exts: [".kml", ".kmz"] },
  { label: "GPX", exts: [".gpx"] },
  { label: "GML", exts: [".gml"] },
  { label: "Shapefile", exts: [".zip"] },
  { label: "GeoPackage", exts: [".gpkg"] },
  { label: "DGN (Microstation)", exts: [".dgn"] },
  { label: "DXF (AutoCAD)", exts: [".dxf"] },
];

const saveLayer = async ({ values, file, id }: SaveParams) => {
  const formData = new FormData();
  formData.append("name", values.name);
  if (values.description) formData.append("description", values.description);
  formData.append("project", values.project);
  formData.append("group", values.group); // empty string = clear group
  if (file) formData.append("file", file);
  return await fetch<Layer>(id ?? "/layers", { method: id ? "PATCH" : "POST", body: formData });
};

const deleteLayer = async (id: string) => await fetch<Layer>(id, { method: "DELETE" });

type ConvertState =
  | null
  | "loading"
  | { type: "confirm"; layers: string[]; groups: Record<string, string[]> }
  | "queued"
  | { type: "error"; msg: string };

export const Form: FunctionComponent<Props> = ({ layer }) => {
  const router = useRouter();
  const [name, setName] = useState(layer?.name ?? "");
  const [description, setDescription] = useState(layer?.description ?? "");
  const [projectIri, setProjectIri] = useState(typeof layer?.project === "string" ? layer.project : (layer?.project as any)?.["@id"] ?? "");
  const [projectInput, setProjectInput] = useState(typeof layer?.project === "object" && layer.project ? (layer.project as any).name ?? "" : "");
  const [projects, setProjects] = useState<Project[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [groups, setGroups] = useState<LayerGroup[]>([]);
  const [groupIri, setGroupIri] = useState(
    typeof layer?.group === "string" ? layer.group : (layer?.group as any)?.["@id"] ?? ""
  );
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [convertState, setConvertState] = useState<ConvertState>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch<any>("/projects").then((res) => {
      if (res?.data?.["member"]) setProjects(res.data["member"]);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (projectIri && projects.length > 0) {
      const match = projects.find((p) => p["@id"] === projectIri);
      if (match) setProjectInput(match.name ?? "");
    }
  }, [projectIri, projects]);

  useEffect(() => {
    if (!projectIri) { setGroups([]); return; }
    fetch<any>(`/layer_groups?pagination=false&project=${encodeURIComponent(projectIri)}`)
      .then((res) => { if (res?.data?.["member"]) setGroups(res.data["member"]); })
      .catch(console.error);
  }, [projectIri]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = projects.filter((p) =>
    (p.name ?? "").toLowerCase().includes(projectInput.toLowerCase())
  );

  const handleProjectInput = (value: string) => {
    setProjectInput(value);
    setProjectIri("");
    setGroupIri("");
    setShowDropdown(true);
  };

  const handleSelect = (p: Project) => {
    setProjectInput(p.name ?? "");
    setProjectIri(p["@id"] ?? "");
    setGroupIri("");
    setShowDropdown(false);
  };

  const deleteMutation = useMutation<FetchResponse<Layer> | undefined, Error | FetchError, string>(
    (id) => deleteLayer(id),
    { onSuccess: () => router.push("/layers"), onError: (error) => console.error(error) }
  );

  const handleDelete = () => {
    if (!layer?.["@id"]) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    deleteMutation.mutate(layer["@id"] as string);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectIri) {
      setStatus({ ok: false, msg: "Please select a project from the list." });
      return;
    }
    setIsSubmitting(true);
    setStatus(null);
    try {
      const result = await saveLayer({
        values: { name, description, project: projectIri, group: groupIri },
        file,
        id: layer?.["@id"] as string | undefined,
      });
      if (!layer?.["@id"] && result?.data?.["@id"]) {
        const id = (result.data["@id"] as string).split("/").pop();
        router.push(`/layers/${id}/edit`);
      } else {
        setStatus({ ok: true, msg: "Layer updated." });
        setFile(null);
        setConvertState(null);
      }
    } catch (err: any) {
      setStatus({ ok: false, msg: err.message ?? "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const doConvert = async (confirmed = false, merge = false) => {
    if (!layer?.["@id"]) return;
    const layerId = (layer["@id"] as string).split("/").pop();
    setConvertState("loading");
    try {
      const res = await fetch<any>(`/layers/${layerId}/convert`, {
        method: "POST",
        body: JSON.stringify(confirmed ? { confirmed: true, merge } : {}),
      });
      if (res?.data?.confirmation_needed) {
        setConvertState({
          type: "confirm",
          layers: res.data.layers ?? [],
          groups: res.data.groups ?? {},
        });
      } else {
        setConvertState("queued");
      }
    } catch (err: any) {
      let msg: string;
      if (err instanceof TypeError) {
        msg = `Network error — could not reach the server. (${err.message})`;
      } else if (err?.message && err?.status && err.status !== err.message) {
        msg = `${err.message}: ${err.status}`;
      } else {
        msg = err?.message ?? "Conversion request failed.";
      }
      setConvertState({ type: "error", msg });
    }
  };

  const hasFile = !!(layer?.filePath || file);
  const canConvert = !!layer?.["@id"] && !!layer?.filePath;

  return (
    <div className="form-page">
      <Link href="/layers" className="form-back">&larr; Back to list</Link>
      <h1 className="form-title">{layer ? "Edit Layer" : "Create Layer"}</h1>
      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-field">
          <label className="form-label" htmlFor="layer_name">Name *</label>
          <input id="layer_name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="form-control" />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="layer_description">Description</label>
          <textarea id="layer_description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="form-control" placeholder="Optional description of this layer" />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="layer_project">Project *</label>
          <div className="autocomplete" ref={wrapperRef}>
            <input
              id="layer_project"
              type="text"
              required
              autoComplete="off"
              placeholder="Type to search projects..."
              value={projectInput}
              onChange={(e) => handleProjectInput(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              className="form-control"
            />
            {showDropdown && (
              <ul className="autocomplete-list">
                {filtered.length > 0 ? (
                  filtered.map((p) => (
                    <li
                      key={p["@id"]}
                      className={"autocomplete-item" + (p["@id"] === projectIri ? " autocomplete-item--active" : "")}
                      onMouseDown={() => handleSelect(p)}
                    >
                      {p.name}
                    </li>
                  ))
                ) : (
                  <li className="autocomplete-empty">No projects found</li>
                )}
              </ul>
            )}
          </div>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="layer_group">Group</label>
          <select
            id="layer_group"
            value={groupIri}
            onChange={(e) => setGroupIri(e.target.value)}
            className="form-control"
            disabled={!projectIri}
          >
            <option value="">— No group —</option>
            {groups.map((g) => (
              <option key={g["@id"]} value={g["@id"] ?? ""}>{g.name}</option>
            ))}
          </select>
          {!projectIri && (
            <p className="form-hint">Select a project first to assign a group.</p>
          )}
          {projectIri && groups.length === 0 && (
            <p className="form-hint">No groups in this project yet.</p>
          )}
        </div>

        <div className="form-field">
          <label className="form-label">File</label>
          <FileDropzone
            onFileChange={(f) => { setFile(f); setConvertState(null); }}
            currentFile={file}
            accept={ACCEPTED_EXTENSIONS}
            hintText="Geo file — will be converted to GeoJSON after saving"
          />
          {layer?.filePath && !file && (
            <p className="form-hint">Current file: <strong>{layer.filePath}</strong></p>
          )}
          <div className="format-list">
            <span className="format-list-label">Supported formats:</span>
            {SUPPORTED_FORMATS.map(({ label, exts }) => (
              <span key={label} className="format-entry">
                <span className="format-name">{label}</span>
                {exts.map((ext) => (
                  <code key={ext} className="format-ext">{ext}</code>
                ))}
              </span>
            ))}
          </div>
          <p className="form-hint">Shapefile must be packaged as a <strong>.zip</strong> containing the .shp, .dbf, and .prj files.</p>
        </div>

        {/* Convert section — only in edit mode with a saved file */}
        {canConvert && (
          <div className="form-field">
            <label className="form-label">Conversion</label>

            {convertState === null && (
              <button type="button" onClick={() => doConvert()} className="btn-convert">
                Convert to GeoJSON
              </button>
            )}

            {convertState === "loading" && (
              <div className="converting-banner">
                <div className="converting-spinner" />
                <div><strong>Analysing file&hellip;</strong></div>
              </div>
            )}

            {typeof convertState === "object" && convertState !== null && convertState.type === "confirm" && (() => {
              const groupEntries = Object.entries(convertState.groups);
              const canMerge = groupEntries.length < convertState.layers.length;
              return (
                <div className="alert alert-warning" role="alert">
                  <strong>This file contains {convertState.layers.length} layers across {groupEntries.length} geometry type{groupEntries.length !== 1 ? "s" : ""}:</strong>
                  <ul style={{ margin: "0.5rem 0 0.75rem 1.25rem", padding: 0 }}>
                    {groupEntries.map(([type, names]) => (
                      <li key={type}>
                        <strong>{type}</strong>: {names.map((n) => <code key={n} className="format-ext" style={{ marginRight: "0.25rem" }}>{n}</code>)}
                      </li>
                    ))}
                  </ul>
                  <p style={{ margin: "0 0 0.75rem" }}>How would you like to import them?</p>
                  <div className="form-actions" style={{ marginTop: 0 }}>
                    <button type="button" onClick={() => doConvert(true, false)} className="btn-submit">
                      {convertState.layers.length} separate layer{convertState.layers.length !== 1 ? "s" : ""}
                    </button>
                    {canMerge && (
                      <button type="button" onClick={() => doConvert(true, true)} className="btn-convert">
                        Merge into {groupEntries.length} layer{groupEntries.length !== 1 ? "s" : ""} by geometry type
                      </button>
                    )}
                    <button type="button" onClick={() => setConvertState(null)} className="btn-danger-outline">Cancel</button>
                  </div>
                </div>
              );
            })()}

            {convertState === "queued" && (
              <div className="alert alert-success" role="alert">
                Conversion started. Check the{" "}
                <Link href={getItemPath(layer["@id"], "/layers/[id]")} className="ref-link">
                  layer page
                </Link>{" "}
                for status updates.
              </div>
            )}

            {typeof convertState === "object" && convertState !== null && convertState.type === "error" && (
              <div className="alert alert-error" role="alert">
                {convertState.msg}
                <button type="button" onClick={() => setConvertState(null)} style={{ marginLeft: "0.75rem" }} className="btn-danger-outline">
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {status && (
          <div className={status.ok ? "alert alert-success" : "alert alert-error"} role="alert">
            {status.msg}
          </div>
        )}
        <div className="form-actions">
          <button type="submit" disabled={isSubmitting} className="btn-submit">
            {isSubmitting ? "Saving..." : "Save"}
          </button>
          {layer && (
            <button type="button" onClick={handleDelete} className="btn-danger-outline">Delete</button>
          )}
        </div>
      </form>
    </div>
  );
};
