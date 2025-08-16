// src/context/AuthContext.js
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch user details from backend
  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data);
    } catch (err) {
      console.error("Error fetching user:", err);
      logout(); // clear token if invalid
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // ✅ Login
  const login = async (email, password) => {
    try {
      const res = await axios.post("/api/users/login", { email, password });
      const { token: newToken } = res.data;
      localStorage.setItem("token", newToken);
      setToken(newToken);
      return true;
    } catch (err) {
      console.error("Login failed:", err);
      return false;
    }
  };

  // ✅ Register
  const register = async (name, email, password, role) => {
    try {
      const res = await axios.post("/api/users/register", {
        name,
        email,
        password,
        role,
      });
      const { token: newToken } = res.data;
      localStorage.setItem("token", newToken);
      setToken(newToken);
      return true;
    } catch (err) {
      console.error("Registration failed:", err);
      return false;
    }
  };

  // ✅ Logout
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, register, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
