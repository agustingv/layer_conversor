import { FunctionComponent, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { fetch, FetchError } from "../../utils/dataAccess";
import { Project } from "../../types/Project";
import { Layer } from "../../types/Layer";

interface Props { project?: Project; }

interface LayerOption { iri: string; name: string; }

export const Form: FunctionComponent<Props> = ({ project }) => {
  const router = useRouter();
  const [name, setName] = useState(project?.name ?? "");
  const [selectedLayers, setSelectedLayers] = useState<LayerOption[]>([]);
  const [allLayers, setAllLayers] = useState<LayerOption[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch<any>("/layers").then((res) => {
      if (res?.data?.["member"]) {
        setAllLayers(
          res.data["member"].map((l: any) => ({ iri: l["@id"] ?? "", name: l.name ?? "" }))
        );
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!project?.layers?.length) return;
    const initial = (project.layers as any[]).map((l) =>
      typeof l === "object"
        ? { iri: l["@id"] ?? "", name: l.name ?? "" }
        : { iri: l, name: l.split("/").pop() ?? l }
    );
    setSelectedLayers(initial);
  }, [project]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = allLayers.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedLayers.some((s) => s.iri === l.iri)
  );

  const addLayer = (layer: LayerOption) => {
    setSelectedLayers((prev) => [...prev, layer]);
    setSearch("");
  };

  const removeLayer = (iri: string) => {
    setSelectedLayers((prev) => prev.filter((l) => l.iri !== iri));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    try {
      await fetch<Project>(project?.["@id"] ?? "/projects", {
        method: project?.["@id"] ? "PUT" : "POST",
        body: JSON.stringify({ name, layers: selectedLayers.map((l) => l.iri) }),
      });
      router.push("/projects");
    } catch (err: any) {
      setStatus({ ok: false, msg: err.message ?? "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!project?.["@id"]) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await fetch<Project>(project["@id"]!, { method: "DELETE" });
      router.push("/projects");
    } catch (err: any) {
      setStatus({ ok: false, msg: err.message ?? "An error occurred." });
    }
  };

  return (
    <div className="form-page">
      <Link href="/projects" className="form-back">&larr; Back to list</Link>
      <h1 className="form-title">{project ? "Edit Project" : "Create Project"}</h1>
      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-field">
          <label className="form-label" htmlFor="project_name">Name *</label>
          <input
            id="project_name" type="text" required
            value={name} onChange={(e) => setName(e.target.value)}
            className="form-control"
          />
        </div>

        <div className="form-field">
          <label className="form-label">Layers</label>
          <div className="autocomplete" ref={wrapperRef}>
            <div className="multi-select" onClick={() => wrapperRef.current?.querySelector<HTMLInputElement>(".multi-select-input")?.focus()}>
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
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                className="multi-select-input"
              />
            </div>
            {showDropdown && (
              <ul className="autocomplete-list">
                {filtered.length > 0 ? (
                  filtered.map((l) => (
                    <li key={l.iri} className="autocomplete-item" onMouseDown={() => addLayer(l)}>
                      {l.name}
                    </li>
                  ))
                ) : (
                  <li className="autocomplete-empty">
                    {allLayers.length === 0 ? "No layers available" : "No layers found"}
                  </li>
                )}
              </ul>
            )}
          </div>
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
          {project && (
            <button type="button" onClick={handleDelete} className="btn-danger-outline">Delete</button>
          )}
        </div>
      </form>
    </div>
  );
};
