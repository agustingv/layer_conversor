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

import { Show } from "../../../components/layer-group/Show";
import { PagedCollection } from "../../../types/collection";
import { LayerGroup } from "../../../types/LayerGroup";
import { fetch, FetchResponse, getItemPaths } from "../../../utils/dataAccess";
import { useMercure } from "../../../utils/mercure";

const getLayerGroup = async (id: string | string[] | undefined) =>
  id ? await fetch<LayerGroup>(`/layer_groups/${id}`) : Promise.resolve(undefined);

const Page: NextComponentType<NextPageContext> = () => {
  const router = useRouter();
  const { id } = router.query;

  const { data: { data: layerGroup, hubURL, text } = { hubURL: null, text: "" } } =
    useQuery<FetchResponse<LayerGroup> | undefined>(["layerGroup", id], () =>
      getLayerGroup(id)
    );
  const layerGroupData = useMercure(layerGroup, hubURL);

  if (!layerGroupData) {
    return <DefaultErrorPage statusCode={404} />;
  }

  return (
    <div>
      <Head><title>{`Show Layer Group ${layerGroupData.name}`}</title></Head>
      <Show layerGroup={layerGroupData} text={text} />
    </div>
  );
};

export const getStaticProps: GetStaticProps = async ({
  params: { id } = {},
}) => {
  if (!id) throw new Error("id not in query param");
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["layerGroup", id], () => getLayerGroup(id));

  return {
    props: { dehydratedState: dehydrate(queryClient) },
    revalidate: 1,
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const response = await fetch<PagedCollection<LayerGroup>>("/layer_groups");
  const paths = await getItemPaths(response, "layer_groups", "/layer-groups/[id]");

  return { paths, fallback: true };
};

export default Page;
