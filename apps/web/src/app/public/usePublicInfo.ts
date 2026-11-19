import { useEffect, useState } from 'react';
import { http } from '@/data/http';

let cached: string | null = null;

/** Support email for signed-out pages and the help menu (`GET /public/`), fetched once when needed. */
export function useSupportEmail(enabled = true): string {
  const [email, setEmail] = useState(cached || '');
  useEffect(() => {
    if (!enabled || cached) return;
    http
      .get<{ supportEmail: string }>('/public/')
      .then((r) => setEmail((cached = r.supportEmail)))
      .catch(() => {});
  }, [enabled]);
  return email;
}
