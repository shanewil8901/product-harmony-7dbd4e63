import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
}

let cache: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;

async function loadDirectory(): Promise<Map<string, string>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = api
      .get<DirectoryUser[]>('/users/directory')
      .then(({ data }) => {
        cache = new Map(data.map((u) => [u.id, u.name || u.email]));
        return cache;
      })
      .catch(() => new Map<string, string>());
  }
  return inflight;
}

/**
 * Audit fields (created_by / updated_by / changed_by / decided_by) store the
 * user's id. This resolves those ids to a readable name, falling back to the
 * raw value for legacy rows that still hold an email or a name.
 */
export function useUserNames() {
  const [map, setMap] = useState<Map<string, string>>(cache ?? new Map());

  useEffect(() => {
    let active = true;
    loadDirectory().then((m) => {
      if (active) setMap(new Map(m));
    });
    return () => {
      active = false;
    };
  }, []);

  return (value?: string | null) => (value ? (map.get(value) ?? value) : '—');
}
