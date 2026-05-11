import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar.jsx";
import Particles from "../components/Particles/Particles.jsx";

export default function MainLayout() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Particles />
      <Navbar />
      <div className="cv-page-wrapper">
        <Outlet />
      </div>
    </div>
  );
}
