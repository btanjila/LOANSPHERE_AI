// src/pages/ProfilePage.js
import React from "react";
import Sidebar from "../components/Sidebar";
import UserProfile from "../components/UserProfile";

export default function ProfilePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 bg-gray-50">
        <UserProfile />
      </main>
    </div>
  );
}

