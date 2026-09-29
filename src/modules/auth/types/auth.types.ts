export interface AuthUser {
  fullName: string;
  email: string;
}

export type AuthProvider = "password" | "google";

// Cuenta mock guardada en localStorage. Nunca guarda la contraseña: solo su hash SHA-256.
export interface AuthAccount extends AuthUser {
  passwordHash: string | null; // null = cuenta creada solo con Google
  providers: AuthProvider[];
  createdAt: string; // ISO
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; field: "email" | "password"; message: string };

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  fullName: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
}

export interface ForgotPasswordValues {
  email: string;
}

export interface ResetPasswordValues {
  password: string;
  confirmPassword: string;
}

export type FormErrors<T> = Partial<Record<keyof T, string>>;
