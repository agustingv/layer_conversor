import { NextComponentType, NextPageContext } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "react-query";

import Pagination from "../common/Pagination";
import { List } from "./List";
import { PagedCollection } from "../../types/collection";
import { LayerGroup } from "../../types/LayerGroup";
import { Project } from "../../types/Project";
import { fetch, FetchResponse, parsePage } from "../../utils/dataAccess";
import { useMercure } from "../../utils/mercure";

export const getLayerGroupsPath = (page?: string | string[], project?: string | string[]) => {
  const params = new URLSearchParams();
  if (typeof page === "string") params.set("page", page);
  if (typeof project === "string" && project) params.set("project", project);
  const qs = params.toString();
  return `/layer_groups${qs ? `?${qs}` : ""}`;
};

export const getLayerGroups =
  (page?: string | string[], project?: string | string[]) => async () =>
    await fetch<PagedCollection<LayerGroup>>(getLayerGroupsPath(page, project));

export const PageList: NextComponentType<NextPageContext> = () => {
  const router = useRouter();
  const { page, project } = router.query;
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const { data: projectsData } = useQuery<FetchResponse<PagedCollection<Project>> | undefined>(
    "/projects?pagination=false",
    async () => fetch<PagedCollection<Project>>("/projects?pagination=false")
  );
  const projects = projectsData?.data?.["member"] ?? [];

  const getPagePath = (path: string) => {
    const pageNum = parsePage("layer_groups", path);
    const base = `/layer-groups/page/${pageNum}`;
    return typeof project === "string" && project
      ? `${base}?project=${encodeURIComponent(project)}`
      : base;
  };

  const queryKey = getLayerGroupsPath(page, project);

  const { data: { data: layerGroups, hubURL } = { hubURL: null }, isLoading } =
    useQuery<FetchResponse<PagedCollection<LayerGroup>> | undefined>(
      queryKey,
      getLayerGroups(page, project)
    );
  const collection = useMercure(layerGroups, hubURL);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [queryKey]);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    const ids = collection?.["member"]?.map((g) => g["@id"]!).filter(Boolean) ?? [];
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(ids));
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.size} layer group(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => fetch(id, { method: "DELETE" }))
      );
      setSelectedIds(new Set());
      await queryClient.invalidateQueries(queryKey);
    } finally {
      setDeleting(false);
    }
  };

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    router.push(
      value ? { pathname: "/layer-groups", query: { project: value } } : "/layer-groups"
    );
  };

  return (
    <div>
      <Head><title>Layer Groups</title></Head>
      <h1 className="text-2xl font-bold mb-4">Layer Groups</h1>
      <div className="filter-bar">
        <label className="filter-label" htmlFor="project-filter">Project</label>
        <select
          id="project-filter"
          value={typeof project === "string" ? project : ""}
          onChange={handleProjectChange}
          className="filter-select"
        >
          <option value="">All projects</option>
          {projects.map((p) =>
            p["@id"] && (
              <option key={p["@id"]} value={p["@id"]}>{p.name}</option>
            )
          )}
        </select>
        {selectedIds.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="btn-delete-selected"
          >
            {deleting ? "Deleting…" : `Delete selected (${selectedIds.size})`}
          </button>
        )}
      </div>
      {isLoading && <p className="text-gray-500">Loading...</p>}
      {collection && collection["member"] && (
        <>
          <List
            layerGroups={collection["member"]}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onToggleAll={handleToggleAll}
          />
          <Pagination collection={collection} getPagePath={getPagePath} />
        </>
      )}
      {!isLoading && collection && !collection["member"]?.length && (
        <p className="text-gray-500">No layer groups yet.</p>
      )}
    </div>
  );
};
