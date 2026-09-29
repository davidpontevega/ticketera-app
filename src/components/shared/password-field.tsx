"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { TextField, type TextFieldProps } from "./text-field";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "trailing">;

export function PasswordField(props: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <TextField
      {...props}
      type={isVisible ? "text" : "password"}
      trailing={
        <button
          type="button"
          aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((visible) => !visible)}
          className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Icon className="size-4.5" aria-hidden />
        </button>
      }
    />
  );
}
