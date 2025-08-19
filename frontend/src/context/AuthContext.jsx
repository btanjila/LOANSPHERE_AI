// src/context/AuthContext.jsx
import React, { createContext, useState, useMemo, useCallback, useContext } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(false);

  // Accepts either (email, password) OR ({ email, password })
  const login = useCallback(async (arg1, arg2) => {
    let email, password;
    if (typeof arg1 === "object" && arg1 !== null) {
      email = arg1.email;
      password = arg1.password;
    } else {
      email = arg1;
      password = arg2;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API}/auth/login`, { email, password });
      const { user, token, refreshToken } = res.data;
      setUser(user);
      setToken(token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);
      localStorage.setItem("refreshToken", refreshToken);
      return { success: true, user, token, refreshToken };
    } catch (error) {
      console.error("Login failed:", error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || "Login failed" };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async ({ name, email, password, role = "borrower", phone = "", address = "" }) => {
      try {
        setLoading(true);
        const res = await axios.post(`${API}/auth/register`, {
          name,
          email,
          password,
          role,
          phone,
          address,
        });
        const { user, token, refreshToken } = res.data;
        setUser(user);
        setToken(token);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("token", token);
        localStorage.setItem("refreshToken", refreshToken);
        return { success: true, user, token, refreshToken };
      } catch (error) {
        console.error("Registration failed:", error.response?.data || error.message);
        return { success: false, message: error.response?.data?.message || "Registration failed" };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      isAuthenticated: !!user,
    }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
