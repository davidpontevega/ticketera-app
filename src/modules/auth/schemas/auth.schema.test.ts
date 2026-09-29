import { describe, expect, it } from "vitest";

import type { RegisterFormValues } from "../types/auth.types";
import {
  LOGIN_FORM_DEFAULT,
  REGISTER_FORM_DEFAULT,
  validateLogin,
  validateRegister,
} from "./auth.schema";

const validRegister: RegisterFormValues = {
  fullName: "Maria Perez",
  email: "maria@example.com",
  password: "secreto123",
  acceptedTerms: true,
};

describe("validateLogin", () => {
  it("accepts a valid email and password", () => {
    expect(validateLogin({ email: " maria@example.com ", password: "x" })).toEqual({});
  });

  it("reports both fields when empty", () => {
    expect(validateLogin(LOGIN_FORM_DEFAULT)).toEqual({
      email: "Ingresa un correo valido",
      password: "Ingresa tu contraseña",
    });
  });
});

describe("validateRegister", () => {
  it("accepts a valid form", () => {
    expect(validateRegister(validRegister)).toEqual({});
  });

  it("reports every field when empty", () => {
    expect(Object.keys(validateRegister(REGISTER_FORM_DEFAULT)).sort()).toEqual([
      "acceptedTerms",
      "email",
      "fullName",
      "password",
    ]);
  });

  it("validates the name", () => {
    expect(validateRegister({ ...validRegister, fullName: "Al" }).fullName).toBeDefined();
    expect(validateRegister({ ...validRegister, fullName: "Maria 2" }).fullName).toBeDefined();
  });

  it("requires 8 characters with a letter and a number", () => {
    expect(validateRegister({ ...validRegister, password: "abc12" }).password).toBe(
      "La contraseña debe tener al menos 8 caracteres",
    );
    expect(validateRegister({ ...validRegister, password: "12345678" }).password).toBe(
      "La contraseña debe tener al menos una letra",
    );
    expect(validateRegister({ ...validRegister, password: "abcdefgh" }).password).toBe(
      "La contraseña debe tener al menos un numero",
    );
  });

  it("requires accepting the terms", () => {
    expect(validateRegister({ ...validRegister, acceptedTerms: false }).acceptedTerms).toBe(
      "Acepta los terminos para continuar",
    );
  });
});
