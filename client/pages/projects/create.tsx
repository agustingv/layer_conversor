import { NextComponentType, NextPageContext } from "next";
import Head from "next/head";

import { Form } from "../../components/project/Form";

const Page: NextComponentType<NextPageContext> = () => (
  <div>
    <div>
      <Head>
        <title>Create Project</title>
      </Head>
    </div>
    <Form />
  </div>
);

export default Page;
