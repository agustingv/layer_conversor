import { FunctionComponent, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import Head from "next/head";
import { fetch, getItemPath } from "../../utils/dataAccess";
import { Layer, LayerMetadata } from "../../types/Layer";

const GeoJsonMap = dynamic(() => import("../common/GeoJsonMap"), { ssr: false });

interface Props { layer: Layer; text: string; }

const projectIri = (p: Layer["project"]): string =>
  typeof p === "object" ? (p?.["@id"] ?? "") : (p ?? "");

const projectName = (p: Layer["project"]): string =>
  typeof p === "object" ? (p?.name ?? "") : (p?.split("/").pop() ?? "");

const StatusBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span>—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Converting… (refresh to update)", cls: "status-badge status-badge--pending" },
    done:    { label: "Converted",                        cls: "status-badge status-badge--done" },
    error:   { label: "Conversion failed",                cls: "status-badge status-badge--error" },
  };
  const entry = map[status];
  if (!entry) return <span>{status}</span>;
  return <span className={entry.cls}>{entry.label}</span>;
};

const MetadataPanel = ({ meta }: { meta: LayerMetadata }) => (
  <div className="metadata-panel">
    <h2 className="metadata-title">File metadata</h2>
    <dl className="metadata-grid">
      {meta.geometryType && (
        <>
          <dt>Geometry type</dt>
          <dd><code className="format-ext">{meta.geometryType}</code></dd>
        </>
      )}
      {meta.featureCount !== undefined && (
        <>
          <dt>Feature count</dt>
          <dd>{meta.featureCount.toLocaleString()}</dd>
        </>
      )}
      {meta.crs && (
        <>
          <dt>CRS</dt>
          <dd><code className="format-ext">{meta.crs}</code></dd>
        </>
      )}
      {meta.extent && (
        <>
          <dt>Extent</dt>
          <dd className="metadata-extent">
            <span>W {meta.extent.xmin}</span>
            <span>S {meta.extent.ymin}</span>
            <span>E {meta.extent.xmax}</span>
            <span>N {meta.extent.ymax}</span>
          </dd>
        </>
      )}
      {meta.fields && meta.fields.length > 0 && (
        <>
          <dt>Attributes ({meta.fields.length})</dt>
          <dd>
            <div className="metadata-fields">
              {meta.fields.map((f) => (
                <span key={f.name} className="metadata-field">
                  <code className="format-ext">{f.name}</code>
                  <span className="metadata-field-type">{f.type}</span>
                </span>
              ))}
            </div>
          </dd>
        </>
      )}
    </dl>
  </div>
);

export const Show: FunctionComponent<Props> = ({ layer: initialLayer, text }) => {
  const [layer, setLayer] = useState(initialLayer);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (layer.conversionStatus !== "pending") return;
    const id = setInterval(async () => {
      try {
        const res = await fetch<Layer>(layer["@id"]!);
        if (res?.data) {
          setLayer(res.data);
          if (res.data.conversionStatus !== "pending") clearInterval(id);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [layer["@id"], layer.conversionStatus]);

  const handleDelete = async () => {
    if (!layer["@id"]) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await fetch(layer["@id"], { method: "DELETE" });
      router.push("/layers");
    } catch (err) {
      setError("Error when deleting the resource.");
      console.error(err);
    }
  };

  return (
    <div className="detail-page">
      <Head>
        <title>{"Show Layer " + layer.name}</title>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: text }} />
      </Head>
      <Link href="/layers" className="detail-back">&larr; Back to list</Link>
      <h1 className="detail-title">{layer.name}</h1>

      {layer.geoJsonPath && (
        <GeoJsonMap content={layer.geoJsonPath} />
      )}

      {layer.metadata && Object.keys(layer.metadata).length > 0 && (
        <MetadataPanel meta={layer.metadata} />
      )}

      <table className="detail-table">
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr><th scope="row">Name</th><td>{layer.name}</td></tr>
          {layer.description && (
            <tr><th scope="row">Description</th><td>{layer.description}</td></tr>
          )}
          <tr>
            <th scope="row">Conversion</th>
            <td>
              <StatusBadge status={layer.conversionStatus} />
              {layer.conversionStatus === "error" && layer.conversionError && (
                <pre className="conversion-error">{layer.conversionError}</pre>
              )}
            </td>
          </tr>
          <tr><th scope="row">File</th><td>{layer.filePath ?? "—"}</td></tr>
          <tr><th scope="row">GeoJSON path</th><td>{layer.geoJsonPath ?? "—"}</td></tr>
          <tr>
            <th scope="row">Project</th>
            <td>
              <Link href={getItemPath(projectIri(layer.project), "/projects/[id]")} className="ref-link">
                {projectName(layer.project)}
              </Link>
            </td>
          </tr>
          <tr><th scope="row">Updated</th><td>{layer.updatedAt ? new Date(layer.updatedAt).toLocaleString() : "—"}</td></tr>
        </tbody>
      </table>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="detail-actions">
        <Link href={getItemPath(layer["@id"], "/layers/[id]/edit")} className="btn-edit">Edit</Link>
        <button className="btn-delete" onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
};
