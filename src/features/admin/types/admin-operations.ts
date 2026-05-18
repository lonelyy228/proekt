export type AdminRuntimeCheckStatus = "HEALTHY" | "WARNING" | "CRITICAL";

export type AdminRuntimeCheck = {
  key: string;
  label: string;
  description: string;
  status: AdminRuntimeCheckStatus;
  passed: boolean;
  message: string;
};

export type AdminRuntimeSnapshot = {
  generatedAt: string;
  checks: AdminRuntimeCheck[];
  summary: {
    healthy: number;
    warning: number;
    critical: number;
  };
  securityControls: string[];
  operationsChecklist: string[];
};

export type AdminBackupsDrillRow = {
  name: string;
  cadence: string;
  objective: string;
  target: string;
  owner: string;
};

export type AdminBackupsSnapshot = {
  generatedAt: string;
  provider: {
    database: string;
    uploadStorage: string;
  };
  status: {
    databaseReachable: boolean;
    uploadConfigured: boolean;
    pitrLikelySupported: boolean;
  };
  policyChecklist: string[];
  restoreRunbook: string[];
  drills: AdminBackupsDrillRow[];
  notes: string[];
};
