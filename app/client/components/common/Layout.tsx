import { ReactNode, useState } from "react";
import { DehydratedState, Hydrate, QueryClient, QueryClientProvider } from "react-query";
import { AuthGuard } from "./AuthGuard";

const Layout = ({ children, dehydratedState }: { children: ReactNode; dehydratedState: DehydratedState }) => {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <Hydrate state={dehydratedState}>
        <AuthGuard>{children}</AuthGuard>
      </Hydrate>
    </QueryClientProvider>
  );
};

export default Layout;
