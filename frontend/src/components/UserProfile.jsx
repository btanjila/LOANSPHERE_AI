// frontend/src/components/UserProfile.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";

const UserProfile = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading user info…
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-center text-blue-600">
        User Profile
      </h2>
      <div className="space-y-3 text-gray-700">
        <p><strong>Name:</strong> {user.name || "N/A"}</p>
        <p><strong>Email:</strong> {user.email || "N/A"}</p>
        <p><strong>Phone:</strong> {user.phone || "N/A"}</p>
        <p><strong>Address:</strong> {user.address || "N/A"}</p>
        <p><strong>Role:</strong> {user.role || "N/A"}</p>
      </div>
    </div>
  );
};

export default UserProfile;
