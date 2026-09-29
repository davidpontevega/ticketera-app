export { AuthLayout } from "./components/auth-layout";
export type { AuthLayoutProps } from "./components/auth-layout";
export { LoginForm } from "./components/login-form";
export { RegisterForm } from "./components/register-form";
export { ForgotPasswordForm, RESET_PASSWORD_PATH } from "./components/forgot-password-form";
export { ResetPasswordForm } from "./components/reset-password-form";
export { UserMenu, MY_TICKETS_PATH } from "./components/user-menu";
export type { UserMenuProps } from "./components/user-menu";

export { useAuthStore } from "./store/auth.store";
export type { AuthState } from "./store/auth.store";

export {
  validateForgotPassword,
  validateLogin,
  validateRegister,
  validateResetPassword,
} from "./schemas/auth.schema";
export {
  DEMO_ACCOUNT,
  decodeGoogleCredential,
  getAuthHref,
  getInitials,
  getNameFromEmail,
  getSafeRedirect,
  hashPassword,
} from "./utils/auth.utils";

export type {
  AuthAccount,
  AuthProvider,
  AuthResult,
  AuthUser,
  LoginFormValues,
  RegisterFormValues,
} from "./types/auth.types";
