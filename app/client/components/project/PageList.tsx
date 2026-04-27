import { NextComponentType, NextPageContext } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import { useQuery } from "react-query";

import Pagination from "../common/Pagination";
import { List } from "./List";
import { PagedCollection } from "../../types/collection";
import { Project } from "../../types/Project";
import { fetch, FetchResponse, parsePage } from "../../utils/dataAccess";
import { useMercure } from "../../utils/mercure";

export const getProjectsPath = (page?: string | string[] | undefined) =>
  `/projects${typeof page === "string" ? `?page=${page}` : ""}`;
export const getProjects = (page?: string | string[] | undefined) => async () =>
  await fetch<PagedCollection<Project>>(getProjectsPath(page));
const getPagePath = (path: string) =>
  `/projects/page/${parsePage("projects", path)}`;

export const PageList: NextComponentType<NextPageContext> = () => {
  const { query: { page } } = useRouter();
  const { data: { data: projects, hubURL } = { hubURL: null }, isLoading } =
    useQuery<FetchResponse<PagedCollection<Project>> | undefined>(
      getProjectsPath(page),
      getProjects(page)
    );
  const collection = useMercure(projects, hubURL);

  return (
    <div>
      <Head><title>Projects</title></Head>
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      {isLoading && <p className="text-gray-500">Loading...</p>}
      {collection && collection["member"] && (
        <>
          <List projects={collection["member"]} />
          <Pagination collection={collection} getPagePath={getPagePath} />
        </>
      )}
      {!isLoading && collection && !collection["member"]?.length && (
        <p className="text-gray-500">No projects yet.</p>
      )}
    </div>
  );
};
