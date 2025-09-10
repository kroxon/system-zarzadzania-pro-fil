// Funkcja mapująca role backendowe na frontendowe
// Backend: 'Admin', 'Employee', 'FirstContact'
// Frontend: 'admin', 'employee', 'contact'

export function mapBackendRoleToFrontend(role: string): 'admin' | 'employee' | 'contact' {
  switch (role) {
    case 'Admin':
      return 'admin';
    case 'Employee':
      return 'employee';
    case 'FirstContact':
      return 'contact';
    default:
      return 'employee'; // fallback
  }
}

// Przykład użycia dla tablicy ról
export function mapBackendRolesToFrontend(roles: string[]): Array<'admin' | 'employee' | 'contact'> {
  return roles.map(mapBackendRoleToFrontend);
}
