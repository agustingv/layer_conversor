import { FunctionComponent, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { fetch, FetchError, FetchResponse } from "../../utils/dataAccess";
import { LayerGroup } from "../../types/LayerGroup";
import { Project } from "../../types/Project";

interface Props { layerGroup?: LayerGroup; }
interface LayerOption { iri: string; name: string; }

const saveLayerGroup = async (
  name: string,
  projectIri: string,
  layerIris: string[],
  id?: string
) =>
  await fetch<LayerGroup>(id ?? "/layer_groups", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify({ name, project: projectIri, layers: layerIris }),
  });

const deleteLayerGroup = async (id: string) =>
  await fetch<LayerGroup>(id, { method: "DELETE" });

export const Form: FunctionComponent<Props> = ({ layerGroup }) => {
  const router = useRouter();
  const [name, setName] = useState(layerGroup?.name ?? "");
  const [projectIri, setProjectIri] = useState(
    typeof layerGroup?.project === "string"
      ? layerGroup.project
      : (layerGroup?.project as any)?.["@id"] ?? ""
  );
  const [projectInput, setProjectInput] = useState(
    typeof layerGroup?.project === "object" && layerGroup.project
      ? (layerGroup.project as any).name ?? ""
      : ""
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectRef = useRef<HTMLDivElement>(null);

  const [allLayers, setAllLayers] = useState<LayerOption[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<LayerOption[]>([]);
  const [layerSearch, setLayerSearch] = useState("");
  const [showLayerDropdown, setShowLayerDropdown] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch<any>("/projects?pagination=false").then((res) => {
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
    if (!projectIri) {
      setAllLayers([]);
      return;
    }
    fetch<any>(`/layers?project=${encodeURIComponent(projectIri)}&pagination=false`)
      .then((res) => {
        if (res?.data?.["member"]) {
          setAllLayers(
            res.data["member"].map((l: any) => ({ iri: l["@id"] ?? "", name: l.name ?? "" }))
          );
        }
      })
      .catch(console.error);
  }, [projectIri]);

  useEffect(() => {
    if (!layerGroup?.layers?.length) return;
    const initial = (layerGroup.layers as any[]).map((l) =>
      typeof l === "object"
        ? { iri: l["@id"] ?? "", name: l.name ?? "" }
        : { iri: l, name: l.split("/").pop() ?? l }
    );
    setSelectedLayers(initial);
  }, [layerGroup]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node))
        setShowProjectDropdown(false);
      if (layerRef.current && !layerRef.current.contains(e.target as Node))
        setShowLayerDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredProjects = projects.filter((p) =>
    (p.name ?? "").toLowerCase().includes(projectInput.toLowerCase())
  );

  const filteredLayers = allLayers.filter(
    (l) =>
      l.name.toLowerCase().includes(layerSearch.toLowerCase()) &&
      !selectedLayers.some((s) => s.iri === l.iri)
  );

  const handleProjectInput = (value: string) => {
    setProjectInput(value);
    setProjectIri("");
    setSelectedLayers([]);
    setAllLayers([]);
    setShowProjectDropdown(true);
  };

  const handleSelectProject = (p: Project) => {
    setProjectInput(p.name ?? "");
    setProjectIri(p["@id"] ?? "");
    setSelectedLayers([]);
    setShowProjectDropdown(false);
  };

  const addLayer = (layer: LayerOption) => {
    setSelectedLayers((prev) => [...prev, layer]);
    setLayerSearch("");
  };

  const removeLayer = (iri: string) => {
    setSelectedLayers((prev) => prev.filter((l) => l.iri !== iri));
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
      await saveLayerGroup(
        name,
        projectIri,
        selectedLayers.map((l) => l.iri),
        layerGroup?.["@id"] as string | undefined
      );
      router.push("/layer-groups");
    } catch (err: any) {
      setStatus({ ok: false, msg: err.message ?? "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!layerGroup?.["@id"]) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteLayerGroup(layerGroup["@id"]!);
      router.push("/layer-groups");
    } catch (err: any) {
      setStatus({ ok: false, msg: err.message ?? "An error occurred." });
    }
  };

  return (
    <div className="form-page">
      <Link href="/layer-groups" className="form-back">&larr; Back to list</Link>
      <h1 className="form-title">{layerGroup ? "Edit Layer Group" : "Create Layer Group"}</h1>
      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-field">
          <label className="form-label" htmlFor="group_name">Name *</label>
          <input
            id="group_name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-control"
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="group_project">Project *</label>
          <div className="autocomplete" ref={projectRef}>
            <input
              id="group_project"
              type="text"
              required
              autoComplete="off"
              placeholder="Type to search projects..."
              value={projectInput}
              onChange={(e) => handleProjectInput(e.target.value)}
              onFocus={() => setShowProjectDropdown(true)}
              className="form-control"
            />
            {showProjectDropdown && (
              <ul className="autocomplete-list">
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((p) => (
                    <li
                      key={p["@id"]}
                      className={"autocomplete-item" + (p["@id"] === projectIri ? " autocomplete-item--active" : "")}
                      onMouseDown={() => handleSelectProject(p)}
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
          <label className="form-label">Layers</label>
          {!projectIri && (
            <p className="form-hint">Select a project first to add layers.</p>
          )}
          {projectIri && (
            <div className="autocomplete" ref={layerRef}>
              <div
                className="multi-select"
                onClick={() => layerRef.current?.querySelector<HTMLInputElement>(".multi-select-input")?.focus()}
              >
                {selectedLayers.map((l) => (
                  <span key={l.iri} className="chip">
                    {l.name}
                    <button type="button" className="chip-remove" onClick={() => removeLayer(l.iri)}>
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  autoComplete="off"
                  placeholder={selectedLayers.length === 0 ? "Type to search layers..." : "Add more..."}
                  value={layerSearch}
                  onChange={(e) => { setLayerSearch(e.target.value); setShowLayerDropdown(true); }}
                  onFocus={() => setShowLayerDropdown(true)}
                  className="multi-select-input"
                />
              </div>
              {showLayerDropdown && (
                <ul className="autocomplete-list">
                  {filteredLayers.length > 0 ? (
                    filteredLayers.map((l) => (
                      <li key={l.iri} className="autocomplete-item" onMouseDown={() => addLayer(l)}>
                        {l.name}
                      </li>
                    ))
                  ) : (
                    <li className="autocomplete-empty">
                      {allLayers.length === 0 ? "No layers in this project" : "No layers found"}
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {status && (
          <div className={status.ok ? "alert alert-success" : "alert alert-error"} role="alert">
            {status.msg}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting} className="btn-submit">
            {isSubmitting ? "Saving..." : "Save"}
          </button>
          {layerGroup && (
            <button type="button" onClick={handleDelete} className="btn-danger-outline">Delete</button>
          )}
        </div>
      </form>
    </div>
  );
};
