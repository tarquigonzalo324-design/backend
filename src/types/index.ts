export interface Usuario {
  id: number;
  username: string;
  password_hash: string;
  nombre_completo: string;
  email?: string;
  cargo?: string;
  rol?: string;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface HojaRuta {
  id: number;
  numero_hr: string;
  referencia: string;
  procedencia: string;
  nombre_solicitante?: string;
  telefono_celular?: string;
  fecha_documento?: Date;
  fecha_ingreso: Date;
  cite?: string;
  numero_fojas?: number;
  prioridad: string;
  estado: string;
  observaciones?: string;
  usuario_creador_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  usuario: {
    id: number;
    username: string;
    nombre_completo: string;
    rol?: string;
    unidad_id?: number | null;
    unidad_nombre?: string | null;
  };
}