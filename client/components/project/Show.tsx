import { FunctionComponent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Head from "next/head";
import { fetch, getItemPath } from "../../utils/dataAccess";
import { Project } from "../../types/Project";

interface Props { project: Project; text: string; }

type LayerRef = string | { "@id"?: string; name?: string };

const layerIri = (l: LayerRef): string =>
  typeof l === "object" ? (l["@id"] ?? "") : l;

const layerName = (l: LayerRef): string =>
  typeof l === "object" ? (l.name ?? "") : (l.split("/").pop() ?? l);

export const Show: FunctionComponent<Props> = ({ project, text }) => {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    if (!project["@id"]) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await fetch(project["@id"], { method: "DELETE" });
      router.push("/projects");
    } catch (err) {
      setError("Error when deleting the resource.");
      console.error(err);
    }
  };

  return (
    <div className="detail-page">
      <Head>
        <title>{"Show Project " + project.name}</title>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: text }} />
      </Head>
      <Link href="/projects" className="detail-back">&larr; Back to list</Link>
      <h1 className="detail-title">{project.name}</h1>
      <table className="detail-table">
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr><th scope="row">Name</th><td>{project.name}</td></tr>
          <tr>
            <th scope="row">Layers</th>
            <td>
              {(project.layers ?? []).map((l, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <Link href={getItemPath(layerIri(l as LayerRef), "/layers/[id]")} className="ref-link">
                    {layerName(l as LayerRef)}
                  </Link>
                </span>
              ))}
            </td>
          </tr>
        </tbody>
      </table>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="detail-actions">
        <Link href={getItemPath(project["@id"], "/projects/[id]/edit")} className="btn-edit">Edit</Link>
        <button className="btn-delete" onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
};
