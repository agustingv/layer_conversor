import { FunctionComponent, useState } from "react";
import { useFormik } from "formik";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { loginUser } from "../../utils/auth";

export const LoginForm: FunctionComponent = () => {
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  const formik = useFormik({
    initialValues: { email: "", password: "" },
    onSubmit: async ({ email, password }, { setSubmitting }) => {
      setError(null);
      try {
        const { token } = await loginUser(email, password);
        login(token, email);
        router.push("/");
      } catch (err: any) {
        setError(err.message ?? "An error occurred.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="auth-card">
      <form onSubmit={formik.handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="form-input"
            value={formik.values.email}
            onChange={formik.handleChange}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="form-input"
            value={formik.values.password}
            onChange={formik.handleChange}
            required
            autoComplete="current-password"
          />
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <button type="submit" className="btn-primary" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Please wait…" : "Login"}
        </button>
      </form>
    </div>
  );
};
