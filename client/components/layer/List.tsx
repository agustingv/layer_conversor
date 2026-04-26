import { FunctionComponent, useEffect, useRef } from "react";
import Link from "next/link";
import { getItemPath } from "../../utils/dataAccess";
import { Layer } from "../../types/Layer";
import { LayerGroup } from "../../types/LayerGroup";

interface Props {
  layers: Layer[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

const projectName = (project: Layer["project"]): string => {
  if (!project) return "";
  if (typeof project === "object") return project.name ?? "";
  return project.split("/").pop() ?? project;
};

const groupInfo = (group: Layer["group"]): { iri: string; name: string } | null => {
  if (!group) return null;
  if (typeof group === "object") return { iri: group["@id"] ?? "", name: group.name ?? "" };
  return { iri: group, name: group.split("/").pop() ?? group };
};

const StatusBadge = ({ status, hasFile }: { status?: string | null; hasFile?: boolean }) => {
  if (!status) {
    return hasFile ? <span className="status-badge status-badge--idle">Not converted</span> : null;
  }
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Converting…", cls: "status-badge status-badge--pending" },
    done:    { label: "Converted",   cls: "status-badge status-badge--done" },
    error:   { label: "Error",       cls: "status-badge status-badge--error" },
  };
  const entry = map[status];
  if (!entry) return null;
  return <span className={entry.cls}>{entry.label}</span>;
};

const SelectAllCheckbox = ({
  total,
  selected,
  onToggleAll,
}: {
  total: number;
  selected: number;
  onToggleAll: () => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = selected > 0 && selected < total;
    }
  }, [selected, total]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={total > 0 && selected === total}
      onChange={onToggleAll}
      aria-label="Select all"
      className="row-checkbox"
    />
  );
};

export const List: FunctionComponent<Props> = ({ layers, selectedIds, onToggle, onToggleAll }) => (
  <table className="resource-table">
    <thead>
      <tr>
        <th className="col-check">
          <SelectAllCheckbox
            total={layers.length}
            selected={layers.filter((l) => l["@id"] && selectedIds.has(l["@id"]!)).length}
            onToggleAll={onToggleAll}
          />
        </th>
        <th>Name</th>
        <th>Project</th>
        <th>Group</th>
        <th>Conversion</th>
        <th>Created</th>
        <th colSpan={2} />
      </tr>
    </thead>
    <tbody>
      {layers.map((layer) =>
        layer["@id"] && (
          <tr key={layer["@id"]} className={selectedIds.has(layer["@id"]) ? "row-selected" : ""}>
            <td className="col-check">
              <input
                type="checkbox"
                checked={selectedIds.has(layer["@id"])}
                onChange={() => onToggle(layer["@id"]!)}
                aria-label={"Select " + layer.name}
                className="row-checkbox"
              />
            </td>
            <td>{layer["name"]}</td>
            <td>{projectName(layer["project"])}</td>
            <td>
              {(() => {
                const g = groupInfo(layer.group);
                return g ? (
                  <Link href={getItemPath(g.iri, "/layer-groups/[id]")} className="ref-link">
                    {g.name}
                  </Link>
                ) : <span className="text-muted">—</span>;
              })()}
            </td>
            <td><StatusBadge status={layer.conversionStatus} hasFile={!!layer.filePath} /></td>
            <td>{layer.createdAt ? new Date(layer.createdAt).toLocaleDateString() : "—"}</td>
            <td className="col-action">
              <Link href={getItemPath(layer["@id"], "/layers/[id]")} className="table-link">Show</Link>
            </td>
            <td className="col-action">
              <Link href={getItemPath(layer["@id"], "/layers/[id]/edit")} className="table-link">Edit</Link>
            </td>
          </tr>
        )
      )}
    </tbody>
  </table>
);
