import { GetStaticPaths, GetStaticProps } from "next";
import { dehydrate, QueryClient } from "react-query";

import {
  PageList,
  getProjects,
  getProjectsPath,
} from "../../../components/project/PageList";
import { PagedCollection } from "../../../types/collection";
import { Project } from "../../../types/Project";
import { fetch, getCollectionPaths } from "../../../utils/dataAccess";

export const getStaticProps: GetStaticProps = async ({
  params: { page } = {},
}) => {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(getProjectsPath(page), getProjects(page));

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 1,
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const response = await fetch<PagedCollection<Project>>("/projects");
  const paths = await getCollectionPaths(
    response,
    "projects",
    "/projects/page/[page]"
  );

  return {
    paths,
    fallback: true,
  };
};

export default PageList;
