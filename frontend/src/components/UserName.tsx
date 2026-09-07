import { useUserNames } from '../hooks/useUserNames';

/** Renders an audit user id (created_by / changed_by / decided_by) as a name. */
export function UserName({ value }: { value?: string | null }) {
  const resolve = useUserNames();
  return <>{resolve(value)}</>;
}
