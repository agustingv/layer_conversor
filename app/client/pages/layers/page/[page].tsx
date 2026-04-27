import { GetStaticPaths, GetStaticProps } from "next";
import { dehydrate, QueryClient } from "react-query";

import {
  PageList,
  getLayers,
  getLayersPath,
} from "../../../components/layer/PageList";
import { PagedCollection } from "../../../types/collection";
import { Layer } from "../../../types/Layer";
import { fetch, getCollectionPaths } from "../../../utils/dataAccess";

export const getStaticProps: GetStaticProps = async ({
  params: { page } = {},
}) => {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(getLayersPath(page), getLayers(page));

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 1,
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const response = await fetch<PagedCollection<Layer>>("/layers");
  const paths = await getCollectionPaths(
    response,
    "layers",
    "/layers/page/[page]"
  );

  return {
    paths,
    fallback: true,
  };
};

export default PageList;
