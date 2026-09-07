import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";

export function Layout({ children }: { children?: ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">
        {children || <Outlet />}
      </main>
    </>
  );
}
