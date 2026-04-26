import { FunctionComponent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Head from "next/head";
import { fetch, getItemPath } from "../../utils/dataAccess";
import { LayerGroup } from "../../types/LayerGroup";

interface Props { layerGroup: LayerGroup; text: string; }

type LayerRef = string | { "@id"?: string; name?: string };
type ProjectRef = string | { "@id"?: string; name?: string };

const getIri = (ref: LayerRef | ProjectRef | undefined): string => {
  if (!ref) return "";
  if (typeof ref === "object") return ref["@id"] ?? "";
  return ref;
};

const getName = (ref: LayerRef | ProjectRef | undefined): string => {
  if (!ref) return "";
  if (typeof ref === "object") return ref.name ?? "";
  return ref.split("/").pop() ?? ref;
};

export const Show: FunctionComponent<Props> = ({ layerGroup, text }) => {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    if (!layerGroup["@id"]) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await fetch(layerGroup["@id"], { method: "DELETE" });
      router.push("/layer-groups");
    } catch (err) {
      setError("Error when deleting the resource.");
      console.error(err);
    }
  };

  const layers = (layerGroup.layers ?? []) as LayerRef[];

  return (
    <div className="detail-page">
      <Head>
        <title>{"Show Layer Group " + layerGroup.name}</title>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: text }} />
      </Head>
      <Link href="/layer-groups" className="detail-back">&larr; Back to list</Link>
      <h1 className="detail-title">{layerGroup.name}</h1>
      <table className="detail-table">
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr><th scope="row">Name</th><td>{layerGroup.name}</td></tr>
          <tr>
            <th scope="row">Project</th>
            <td>
              {layerGroup.project ? (
                <Link
                  href={getItemPath(getIri(layerGroup.project), "/projects/[id]")}
                  className="ref-link"
                >
                  {getName(layerGroup.project)}
                </Link>
              ) : "—"}
            </td>
          </tr>
          <tr>
            <th scope="row">Layers ({layers.length})</th>
            <td>
              {layers.length > 0 ? (
                <div>
                  {layers.map((l, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      <Link href={getItemPath(getIri(l), "/layers/[id]")} className="ref-link">
                        {getName(l)}
                      </Link>
                    </span>
                  ))}
                </div>
              ) : "—"}
            </td>
          </tr>
        </tbody>
      </table>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="detail-actions">
        <Link href={getItemPath(layerGroup["@id"], "/layer-groups/[id]/edit")} className="btn-edit">Edit</Link>
        <button className="btn-delete" onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
};
