import { FunctionComponent, useEffect, useRef } from "react";
import Link from "next/link";
import { getItemPath } from "../../utils/dataAccess";
import { LayerGroup } from "../../types/LayerGroup";

interface Props {
  layerGroups: LayerGroup[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

const projectName = (project: LayerGroup["project"]): string => {
  if (!project) return "";
  if (typeof project === "object") return project.name ?? "";
  return project.split("/").pop() ?? project;
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

export const List: FunctionComponent<Props> = ({ layerGroups, selectedIds, onToggle, onToggleAll }) => (
  <table className="resource-table">
    <thead>
      <tr>
        <th className="col-check">
          <SelectAllCheckbox
            total={layerGroups.length}
            selected={layerGroups.filter((g) => g["@id"] && selectedIds.has(g["@id"]!)).length}
            onToggleAll={onToggleAll}
          />
        </th>
        <th>Name</th>
        <th>Project</th>
        <th>Layers</th>
        <th colSpan={2} />
      </tr>
    </thead>
    <tbody>
      {layerGroups.map((group) =>
        group["@id"] && (
          <tr key={group["@id"]} className={selectedIds.has(group["@id"]) ? "row-selected" : ""}>
            <td className="col-check">
              <input
                type="checkbox"
                checked={selectedIds.has(group["@id"])}
                onChange={() => onToggle(group["@id"]!)}
                aria-label={"Select " + group.name}
                className="row-checkbox"
              />
            </td>
            <td>{group.name}</td>
            <td>{projectName(group.project)}</td>
            <td>{Array.isArray(group.layers) ? group.layers.length : 0}</td>
            <td className="col-action">
              <Link href={getItemPath(group["@id"], "/layer-groups/[id]")} className="table-link">Show</Link>
            </td>
            <td className="col-action">
              <Link href={getItemPath(group["@id"], "/layer-groups/[id]/edit")} className="table-link">Edit</Link>
            </td>
          </tr>
        )
      )}
    </tbody>
  </table>
);
