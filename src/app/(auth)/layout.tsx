import { AuthLayout } from "@/modules/auth";

export default function AuthGroupLayout({ children }: LayoutProps<"/">) {
  return <AuthLayout>{children}</AuthLayout>;
}
