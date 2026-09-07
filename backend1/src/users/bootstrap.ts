/**
 * The temporary account created on a brand-new database so someone can sign in
 * and create the real admin. It is deleted the moment a genuine admin exists
 * and is never recreated afterwards.
 */
export const BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
