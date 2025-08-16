// src/layouts/DashboardLayout.jsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Home,
  User,
  FileText,
  BarChart2,
  Settings,
  LogOut,
} from "lucide-react";
import AdminDashboard from "../pages/AdminDashboard"; // your analytics page

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || "borrower";

  const menuItems = [
    { to: "/dashboard", label: "Home", icon: <Home size={18} /> },
    { to: "/profile", label: "Profile", icon: <User size={18} /> },
    { to: "/loans", label: "Loan Form", icon: <FileText size={18} /> },
  ];

  if (role === "admin") {
    menuItems.push({
      to: "/admin",
      label: "Admin Panel",
      icon: <BarChart2 size={18} />,
    });
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white shadow-lg">
        <div className="h-16 flex items-center justify-center text-xl font-bold border-b">
          LoanSphere
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-blue-500 text-white shadow"
                    : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="flex items-center space-x-3 px-4 py-2 m-4 rounded-lg bg-red-500 text-white hover:bg-red-600"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-16 bg-white shadow flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold">Welcome, {user?.name}</h1>
          <div className="flex items-center space-x-4">
            <Settings className="cursor-pointer text-gray-600" size={20} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {role === "admin" && window.location.pathname === "/dashboard" ? (
            <AdminDashboard /> // Show analytics if admin is on /dashboard
          ) : (
            <Outlet /> // Load other pages here
          )}
        </main>
      </div>
    </div>
  );
}
