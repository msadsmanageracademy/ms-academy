import { customConfig } from "./custom.js";

const baseConfig = {
  allowRegistration: true,
  strongPassword: true,
};

export const config = { ...baseConfig, ...customConfig };
