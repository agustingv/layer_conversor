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

import { Form } from "../../../components/layer/Form";
import { PagedCollection } from "../../../types/collection";
import { Layer } from "../../../types/Layer";
import { fetch, FetchResponse, getItemPaths } from "../../../utils/dataAccess";

const getLayer = async (id: string | string[] | undefined) =>
  id ? await fetch<Layer>(`/layers/${id}`) : Promise.resolve(undefined);

const Page: NextComponentType<NextPageContext> = () => {
  const router = useRouter();
  const { id } = router.query;

  const { data: { data: layer } = {} } = useQuery<
    FetchResponse<Layer> | undefined
  >(["layer", id], () => getLayer(id));

  if (!layer) {
    return <DefaultErrorPage statusCode={404} />;
  }

  return (
    <div>
      <div>
        <Head>
          <title>{layer && `Edit Layer ${layer["@id"]}`}</title>
        </Head>
      </div>
      <Form layer={layer} />
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
  const paths = await getItemPaths(response, "layers", "/layers/[id]/edit");

  return {
    paths,
    fallback: true,
  };
};

export default Page;
