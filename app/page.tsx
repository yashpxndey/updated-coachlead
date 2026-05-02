'use client';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.href = '/login';
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-white">Loading...</p>
    </div>
  );
}
