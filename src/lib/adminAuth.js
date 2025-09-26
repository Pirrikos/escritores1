// Email del administrador autorizado
const ADMIN_EMAIL = 'proyectoenigmatico@gmail.com';

/**
 * Hook para verificar admin en componentes cliente
 * @param {Object} session - Sesión de Supabase
 * @returns {boolean} - true si es admin
 */
export function isAdminUser(session) {
  if (!session || !session.user || !session.user.email) {
    return false;
  }
  
  return session.user.email === ADMIN_EMAIL;
}

/**
 * Componente de protección para rutas de admin
 */
export function AdminGuard({ children, session, fallback = null }) {
  const isAdmin = isAdminUser(session);
  
  if (!isAdmin) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h1>
          <p className="text-gray-600 mb-4">
            Esta área está reservada exclusivamente para el administrador.
          </p>
          <p className="text-sm text-gray-500">
            Email actual: {session?.user?.email || 'No autenticado'}
          </p>
        </div>
      </div>
    );
  }
  
  return children;
}