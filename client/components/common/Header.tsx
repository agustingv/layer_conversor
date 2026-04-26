import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";

const Header = () => {
  const { isAuthenticated, email, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <nav className="header-nav">
          <Link href="/" className="header-nav-home">Layer Provider</Link>
          <div className="header-nav-group">
            <Link href="/projects" className="header-nav-link">Projects</Link>
            <Link href="/projects/create" className="header-nav-new">+ New</Link>
          </div>
          <div className="header-nav-group">
            <Link href="/layers" className="header-nav-link">Layers</Link>
            <Link href="/layers/create" className="header-nav-new">+ New</Link>
          </div>
          <div className="header-nav-group">
            <Link href="/layer-groups" className="header-nav-link">Layer Groups</Link>
            <Link href="/layer-groups/create" className="header-nav-new">+ New</Link>
          </div>
        </nav>
        <div className="header-auth">
          {isAuthenticated ? (
            <>
              <span className="header-user">{email}</span>
              <button className="header-logout" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <Link href="/login" className="header-nav-link">Login</Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
