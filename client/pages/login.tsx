import Head from "next/head";
import { LoginForm } from "../components/auth/LoginForm";

const LoginPage = () => (
  <>
    <Head><title>Login</title></Head>
    <div className="auth-page">
      <h1 className="auth-title">Layer Provider</h1>
      <LoginForm />
    </div>
  </>
);

export default LoginPage;
