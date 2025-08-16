// src/pages/Profile.js
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const Profile = () => {
  const { user } = useAuth();
  const [cibil, setCibil] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCIBIL = async () => {
      setLoading(true);
      try {
        const res = await api.get('/users/me/cibil');
        setCibil(res.data.score);
      } catch (err) {
        toast.error('❌ Failed to fetch CIBIL score');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'borrower') fetchCIBIL();
  }, [user]);

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">User Profile</h2>
      <div className="space-y-3 text-gray-800">
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Phone:</strong> {user?.phone || 'N/A'}</p>
        <p><strong>Address:</strong> {user?.address || 'N/A'}</p>
        <p><strong>Role:</strong> {user?.role}</p>
        {user?.role === 'borrower' && (
          <p>
            <strong>CIBIL Score:</strong>{' '}
            {loading ? 'Loading...' : cibil ?? 'Not Available'}
          </p>
        )}
      </div>
    </div>
  );
};

export default Profile;
