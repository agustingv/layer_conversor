import dynamic from "next/dynamic";
import { GetStaticProps, NextComponentType, NextPageContext } from "next";
import Head from "next/head";

const MapExplorer = dynamic(
  () => import("../../components/map/MapExplorer"),
  { ssr: false }
);

const Page: NextComponentType<NextPageContext> = () => (
  <>
    <Head><title>Map Explorer</title></Head>
    <MapExplorer />
  </>
);

export const getStaticProps: GetStaticProps = async () => ({ props: {} });

export default Page;
