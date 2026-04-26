import { NextComponentType, NextPageContext } from "next";
import Head from "next/head";
import { Form } from "../../components/layer-group/Form";

const Page: NextComponentType<NextPageContext> = () => (
  <div>
    <Head><title>Create Layer Group</title></Head>
    <Form />
  </div>
);

export default Page;
