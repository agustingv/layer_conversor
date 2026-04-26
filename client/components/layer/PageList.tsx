import { NextComponentType, NextPageContext } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "react-query";

import Pagination from "../common/Pagination";
import { List } from "./List";
import { PagedCollection } from "../../types/collection";
import { Layer } from "../../types/Layer";
import { LayerGroup } from "../../types/LayerGroup";
import { Project } from "../../types/Project";
import { fetch, FetchResponse, parsePage } from "../../utils/dataAccess";
import { useMercure } from "../../utils/mercure";

export const getLayersPath = (
  page?: string | string[],
  project?: string | string[],
  group?: string | string[]
) => {
  const params = new URLSearchParams();
  if (typeof page === "string") params.set("page", page);
  if (typeof project === "string" && project) params.set("project", project);
  if (typeof group === "string" && group) params.set("group", group);
  const qs = params.toString();
  return `/layers${qs ? `?${qs}` : ""}`;
};

export const getLayers =
  (page?: string | string[], project?: string | string[], group?: string | string[]) =>
  async () =>
    await fetch<PagedCollection<Layer>>(getLayersPath(page, project, group));

export const PageList: NextComponentType<NextPageContext> = () => {
  const router = useRouter();
  const { page, project, group } = router.query;
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const { data: projectsData } = useQuery<FetchResponse<PagedCollection<Project>> | undefined>(
    "/projects?pagination=false",
    async () => fetch<PagedCollection<Project>>("/projects?pagination=false")
  );
  const projects = projectsData?.data?.["member"] ?? [];

  // Fetch groups — scoped to selected project when one is active
  const groupsQueryKey = typeof project === "string" && project
    ? `/layer_groups?pagination=false&project=${encodeURIComponent(project)}`
    : "/layer_groups?pagination=false";

  const { data: groupsData } = useQuery<FetchResponse<PagedCollection<LayerGroup>> | undefined>(
    groupsQueryKey,
    async () => fetch<PagedCollection<LayerGroup>>(groupsQueryKey)
  );
  const groups = groupsData?.data?.["member"] ?? [];

  const getPagePath = (path: string) => {
    const pageNum = parsePage("layers", path);
    const params = new URLSearchParams();
    if (typeof project === "string" && project) params.set("project", project);
    if (typeof group === "string" && group) params.set("group", group);
    const qs = params.toString();
    return `/layers/page/${pageNum}${qs ? `?${qs}` : ""}`;
  };

  const queryKey = getLayersPath(page, project, group);

  const { data: { data: layers, hubURL } = { hubURL: null }, isLoading } =
    useQuery<FetchResponse<PagedCollection<Layer>> | undefined>(
      queryKey,
      getLayers(page, project, group),
      {
        refetchInterval: (data) =>
          data?.data?.["member"]?.some((l) => l.conversionStatus === "pending")
            ? 3000
            : false,
      }
    );
  const collection = useMercure(layers, hubURL);

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
    const ids = collection?.["member"]?.map((l) => l["@id"]!).filter(Boolean) ?? [];
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(ids));
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.size} layer(s)? This cannot be undone.`)) return;
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
    // Reset group when project changes — the old group may not belong to the new project
    router.push(value ? { pathname: "/layers", query: { project: value } } : "/layers");
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const query: Record<string, string> = {};
    if (typeof project === "string" && project) query.project = project;
    if (value) query.group = value;
    router.push({ pathname: "/layers", query });
  };

  return (
    <div>
      <Head><title>Layers</title></Head>
      <h1 className="text-2xl font-bold mb-4">Layers</h1>
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

        <label className="filter-label" htmlFor="group-filter">Group</label>
        <select
          id="group-filter"
          value={typeof group === "string" ? group : ""}
          onChange={handleGroupChange}
          className="filter-select"
          disabled={groups.length === 0}
        >
          <option value="">All groups</option>
          {groups.map((g) =>
            g["@id"] && (
              <option key={g["@id"]} value={g["@id"]}>{g.name}</option>
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
            layers={collection["member"]}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onToggleAll={handleToggleAll}
          />
          <Pagination collection={collection} getPagePath={getPagePath} />
        </>
      )}
      {!isLoading && collection && !collection["member"]?.length && (
        <p className="text-gray-500">No layers yet.</p>
      )}
    </div>
  );
};
