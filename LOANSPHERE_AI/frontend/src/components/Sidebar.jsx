// frontend/src/components/Sidebar.jsx
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null; // Don't render sidebar if no user

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const menuItems = [
    { name: "Dashboard", path: "/", icon: HomeIcon, roles: ["admin", "borrower"] },
    { name: "Apply Loan", path: "/loans", icon: ClipboardDocumentListIcon, roles: ["borrower"] },
    { name: "Loan Management", path: "/loan-table", icon: ChartBarIcon, roles: ["admin"] },
    { name: "EMI Tracker", path: "/emi-tracker", icon: CreditCardIcon, roles: ["borrower", "admin"] },
    { name: "Profile", path: "/profile", icon: UserIcon, roles: ["borrower", "admin"] },
  ];

  return (
    <>
      {/* Mobile menu toggle button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Menu"
          className="p-2 bg-blue-600 rounded-md text-white shadow-md"
        >
          ☰
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r shadow-lg transform transition-transform duration-300 z-40
          ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 w-64`}
      >
        {/* Brand header */}
        <div className="flex items-center justify-center h-16 bg-blue-600 text-white font-bold text-xl tracking-wide shadow-md">
          LoanSphere {user.role === "admin" ? "Admin" : "Portal"}
        </div>

        {/* Navigation items */}
        <nav className="p-4 space-y-2">
          {menuItems
            .filter((item) => item.roles.includes(user.role))
            .map((item) => (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center p-3 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? "bg-blue-100 text-blue-700 font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            ))}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex items-center w-full p-3 rounded-lg text-gray-700 hover:bg-red-100 hover:text-red-600 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
            Logout
          </button>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black opacity-50 z-30 lg:hidden"
        ></div>
      )}
    </>
  );
};

export default Sidebar;
