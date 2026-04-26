import { NextComponentType, NextPageContext } from "next";
import Head from "next/head";

import { Form } from "../../components/layer/Form";

const Page: NextComponentType<NextPageContext> = () => (
  <div>
    <div>
      <Head>
        <title>Create Layer</title>
      </Head>
    </div>
    <Form />
  </div>
);

export default Page;
