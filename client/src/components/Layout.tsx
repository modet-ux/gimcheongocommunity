import { Outlet, useLocation } from "react-router-dom";
import { Header } from "../components/Header";

export function Layout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const hideHeader = ["/login", "/register"].includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeader && <Header />}
      {children ?? <Outlet />}
    </div>
  );
}
