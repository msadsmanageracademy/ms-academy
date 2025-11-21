import { customConfig } from "./custom.js";

const baseConfig = {
  strongPassword: true,
};

export const config = { ...baseConfig, ...customConfig };
