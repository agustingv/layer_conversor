import { FunctionComponent } from "react";
import Link from "next/link";
import { getItemPath } from "../../utils/dataAccess";
import { Project } from "../../types/Project";

interface Props {
  projects: Project[];
}

type GroupEntry = { iri: string; name: string };

function resolveGroups(raw: Project["groups"]): GroupEntry[] {
  if (!raw) return [];
  return raw.map((g) =>
    typeof g === "object"
      ? { iri: g["@id"] ?? "", name: g.name ?? "" }
      : { iri: g, name: g.split("/").pop() ?? g }
  );
}

export const List: FunctionComponent<Props> = ({ projects }) => (
  <table className="resource-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Layers</th>
        <th>Groups</th>
        <th colSpan={2} />
      </tr>
    </thead>
    <tbody>
      {projects.map((project) =>
        project["@id"] && (
          <tr key={project["@id"]}>
            <td>{project["name"]}</td>
            <td>{(project["layers"] ?? []).length}</td>
            <td>
              {(() => {
                const groups = resolveGroups(project.groups);
                if (!groups.length) return <span className="text-muted">—</span>;
                return (
                  <div className="group-tag-list">
                    {groups.map((g) => (
                      <Link
                        key={g.iri}
                        href={getItemPath(g.iri, "/layer-groups/[id]")}
                        className="group-tag"
                      >
                        {g.name}
                      </Link>
                    ))}
                  </div>
                );
              })()}
            </td>
            <td className="col-action">
              <Link href={getItemPath(project["@id"], "/projects/[id]")} className="table-link">Show</Link>
            </td>
            <td className="col-action">
              <Link href={getItemPath(project["@id"], "/projects/[id]/edit")} className="table-link">Edit</Link>
            </td>
          </tr>
        )
      )}
    </tbody>
  </table>
);
