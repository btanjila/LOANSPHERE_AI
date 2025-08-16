// frontend/src/components/Navbar.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-indigo-700 text-white px-6 py-3 shadow-md">
      <div className="flex justify-between items-center">
        {/* Brand */}
        <Link
          to={user?.role === "admin" ? "/dashboard" : "/loans"}
          className="text-2xl font-bold tracking-wide hover:opacity-90 transition"
        >
          LoanSphere
        </Link>

        {/* Desktop Menu */}
        {user && (
          <ul className="hidden md:flex items-center space-x-6 text-sm md:text-base">
            {user.role === "admin" && (
              <>
                <li>
                  <Link to="/dashboard" className="hover:underline">
                    📊 Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/loans" className="hover:underline">
                    📝 Loan Records
                  </Link>
                </li>
              </>
            )}
            {user.role === "borrower" && (
              <>
                <li>
                  <Link to="/loans" className="hover:underline">
                    📝 Apply Loan
                  </Link>
                </li>
                <li>
                  <Link to="/emi-tracker" className="hover:underline">
                    📅 EMI Tracker
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link to="/profile" className="hover:underline">
                👤 Profile
              </Link>
            </li>
            <li>
              <button
                onClick={handleLogout}
                className="bg-white text-indigo-700 px-3 py-1 rounded hover:bg-gray-200 transition"
              >
                🔒 Logout
              </button>
            </li>
          </ul>
        )}

        {/* Mobile Menu Toggle */}
        {user && (
          <button
            className="md:hidden text-2xl focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
        )}
      </div>

      {/* Mobile Menu */}
      {menuOpen && user && (
        <ul className="flex flex-col mt-3 space-y-2 md:hidden">
          {user.role === "admin" && (
            <>
              <li>
                <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                  📊 Dashboard
                </Link>
              </li>
              <li>
                <Link to="/loans" onClick={() => setMenuOpen(false)}>
                  📝 Loan Records
                </Link>
              </li>
            </>
          )}
          {user.role === "borrower" && (
            <>
              <li>
                <Link to="/loans" onClick={() => setMenuOpen(false)}>
                  📝 Apply Loan
                </Link>
              </li>
              <li>
                <Link to="/emi-tracker" onClick={() => setMenuOpen(false)}>
                  📅 EMI Tracker
                </Link>
              </li>
            </>
          )}
          <li>
            <Link to="/profile" onClick={() => setMenuOpen(false)}>
              👤 Profile
            </Link>
          </li>
          <li>
            <button
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="bg-white text-indigo-700 px-3 py-1 rounded hover:bg-gray-200 transition w-full text-left"
            >
              🔒 Logout
            </button>
          </li>
        </ul>
      )}
    </nav>
  );
};

export default Navbar;
