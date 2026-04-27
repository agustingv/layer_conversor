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

import { Show } from "../../../components/layer/Show";
import { PagedCollection } from "../../../types/collection";
import { Layer } from "../../../types/Layer";
import { fetch, FetchResponse, getItemPaths } from "../../../utils/dataAccess";
import { useMercure } from "../../../utils/mercure";

const getLayer = async (id: string | string[] | undefined) =>
  id ? await fetch<Layer>(`/layers/${id}`) : Promise.resolve(undefined);

const Page: NextComponentType<NextPageContext> = () => {
  const router = useRouter();
  const { id } = router.query;

  const { data: { data: layer, hubURL, text } = { hubURL: null, text: "" } } =
    useQuery<FetchResponse<Layer> | undefined>(["layer", id], () =>
      getLayer(id)
    );
  const layerData = useMercure(layer, hubURL);

  if (!layerData) {
    return <DefaultErrorPage statusCode={404} />;
  }

  return (
    <div>
      <div>
        <Head>
          <title>{`Show Layer ${layerData["@id"]}`}</title>
        </Head>
      </div>
      <Show layer={layerData} text={text} />
    </div>
  );
};

export const getStaticProps: GetStaticProps = async ({
  params: { id } = {},
}) => {
  if (!id) throw new Error("id not in query param");
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["layer", id], () => getLayer(id));

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 1,
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const response = await fetch<PagedCollection<Layer>>("/layers");
  const paths = await getItemPaths(response, "layers", "/layers/[id]");

  return {
    paths,
    fallback: true,
  };
};

export default Page;
