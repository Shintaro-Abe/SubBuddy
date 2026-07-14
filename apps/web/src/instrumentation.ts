import { validateRuntimeConfiguration } from "@/config/auth";

export function register() {
  validateRuntimeConfiguration();
}
