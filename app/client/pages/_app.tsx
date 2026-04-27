import "../styles/style.css";
import "leaflet/dist/leaflet.css";
import type { AppProps } from "next/app";
import type { DehydratedState } from "react-query";

import Layout from "../components/common/Layout";
import { AuthProvider } from "../context/AuthContext";

const App = ({
  Component,
  pageProps,
}: AppProps<{ dehydratedState: DehydratedState }>) => (
  <AuthProvider>
    <Layout dehydratedState={pageProps.dehydratedState}>
      <Component {...pageProps} />
    </Layout>
  </AuthProvider>
);

export default App;
