import {
  GetStaticPaths,
  GetStaticProps,
  NextComponentType,
  NextPageContext,
} from "next";
import DefaultErrorPage from "next/error";
import Head from "next/head";
import { useRouter } from "next/router";
import { dehydrate, QueryClient, useQuery } from "react-query";

import { Form } from "../../../components/project/Form";
import { PagedCollection } from "../../../types/collection";
import { Project } from "../../../types/Project";
import { fetch, FetchResponse, getItemPaths } from "../../../utils/dataAccess";

const getProject = async (id: string | string[] | undefined) =>
  id ? await fetch<Project>(`/projects/${id}`) : Promise.resolve(undefined);

const Page: NextComponentType<NextPageContext> = () => {
  const router = useRouter();
  const { id } = router.query;

  const { data: { data: project } = {} } = useQuery<
    FetchResponse<Project> | undefined
  >(["project", id], () => getProject(id));

  if (!project) {
    return <DefaultErrorPage statusCode={404} />;
  }

  return (
    <div>
      <div>
        <Head>
          <title>{project && `Edit Project ${project["@id"]}`}</title>
        </Head>
      </div>
      <Form project={project} />
    </div>
  );
};

export const getStaticProps: GetStaticProps = async ({
  params: { id } = {},
}) => {
  if (!id) throw new Error("id not in query param");
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["project", id], () => getProject(id));

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 1,
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const response = await fetch<PagedCollection<Project>>("/projects");
  const paths = await getItemPaths(response, "projects", "/projects/[id]/edit");

  return {
    paths,
    fallback: true,
  };
};

export default Page;
