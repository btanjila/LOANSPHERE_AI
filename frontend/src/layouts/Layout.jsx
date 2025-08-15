// src/layouts/Layout.jsx
import React from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  FileText,
  User,
  Settings,
  LogOut,
} from "lucide-react";

export default function Layout() {
  const { user, logout } = useAuth();
  const role = user?.role || "borrower";

  const menuItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={20} />, to: "/" },
    { name: "Loan Form", icon: <FileText size={20} />, to: "/loans" },
    { name: "Profile", icon: <User size={20} />, to: "/profile" },
  ];

  if (role === "admin") {
    menuItems.push({
      name: "Admin Panel",
      icon: <Settings size={20} />,
      to: "/admin",
    });
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r p-4">
        <div className="text-2xl font-bold mb-6">LoanSphere</div>
        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              to={item.to}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-200 transition"
            >
              {item.icon}
              {item.name}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="mt-auto flex items-center gap-2 p-2 rounded-lg hover:bg-red-100 text-red-600"
        >
          <LogOut size={20} />
          Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="flex items-center justify-between bg-white border-b p-4 shadow-sm">
          <h1 className="text-lg font-semibold">
            Welcome, {user?.name || "User"}
          </h1>
          <span className="text-sm text-gray-500">
            Role: {role.toUpperCase()}
          </span>
        </header>

        {/* Content */}
        <main className="p-4 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
