export interface AuthUser {
  fullName: string;
  email: string;
}

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

export type FormErrors<T> = Partial<Record<keyof T, string>>;
