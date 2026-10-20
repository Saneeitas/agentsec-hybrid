export const API_VERSION = "v1" as const;

export type ServiceHealth = {
  service: "api" | "scanner";
  status: "ok";
  version: string;
};

export type PlatformStatus = {
  api: ServiceHealth;
  scanner: ServiceHealth;
};

