'use client';

import { useEffect, useState } from 'react';

export type SessionUser = { id: string; email: string; name: string; createdAt: string };

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data: { user: SessionUser | null }) => {
        if (alive) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { user, loading, setUser };
}
