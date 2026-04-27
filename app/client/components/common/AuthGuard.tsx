import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import Header from "./Header";

const PUBLIC_PATHS = ["/login"];

const Forbidden = () => (
  <div className="error-page">
    <div className="error-code">403</div>
    <p className="error-message">You must be logged in to access this page.</p>
    <Link href="/login" className="btn-primary">Go to Login</Link>
  </div>
);

export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  const { pathname } = useRouter();

  if (loading) return null;

  if (PUBLIC_PATHS.includes(pathname)) {
    return <main className="page-main">{children}</main>;
  }

  if (!isAuthenticated) {
    return <Forbidden />;
  }

  return (
    <>
      <Header />
      <main className="page-main">{children}</main>
    </>
  );
};
