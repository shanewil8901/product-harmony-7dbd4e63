import { useEffect, useState } from 'react';
import { employeesService } from '../services/hr.service';
import { EmployeeProfileView } from '../components/EmployeeProfileView';
import type { ApiError } from '../services/api';
import type { EmployeeSelfOverview } from '../types/hr';

export function MyProfilePage() {
  const [data, setData] = useState<EmployeeSelfOverview | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await employeesService.myOverview());
    } catch (e) {
      setError((e as ApiError).userMessage ?? 'Could not load your profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Photo is optional — a missing one simply falls back to the default avatar.
  useEffect(() => {
    let url: string | null = null;
    employeesService
      .myPhotoUrl()
      .then((u) => {
        url = u;
        setPhoto(u);
      })
      .catch(() => setPhoto(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  if (loading) return <div className="card p-8 text-sm text-brown-500">Loading your profile…</div>;

  if (error || !data)
    return (
      <div className="card p-8 text-center">
        <h1 className="font-serif text-2xl text-ink">My profile</h1>
        <p className="mt-2 text-sm text-brown-600">
          {error ?? 'No employee profile is linked to your account.'}
        </p>
        <button className="btn-ghost mt-4" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );

  return <EmployeeProfileView data={data} photo={photo} self />;
}
