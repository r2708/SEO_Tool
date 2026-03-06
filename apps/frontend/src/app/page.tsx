'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-xl">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">SEO SaaS Platform</h1>
        <p className="text-xl text-gray-600 mb-8">
          All-in-One SEO Solution
        </p>
        <div className="space-x-4">
          <Link
            href="/login"
            className="inline-block px-6 py-3 text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-block px-6 py-3 text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
