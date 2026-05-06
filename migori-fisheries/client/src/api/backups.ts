import { apiClient } from "@/api/client";

export type BackupMetadata = {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
};

export const backupsApi = {
  async getLatest(): Promise<BackupMetadata | null> {
    const { data } = await apiClient.get<{ data: { latest: BackupMetadata | null } }>("/backups");
    return data.data.latest;
  },

  async run(): Promise<BackupMetadata> {
    const { data } = await apiClient.post<{ data: BackupMetadata }>("/backups");
    return data.data;
  },

  async downloadLatest(): Promise<{ blob: Blob; fileName: string }> {
    const response = await apiClient.get<Blob>("/backups/latest/download", {
      responseType: "blob"
    });

    const disposition = response.headers["content-disposition"];
    const fileNameMatch = typeof disposition === "string" ? /filename="([^"]+)"/.exec(disposition) : null;

    return {
      blob: response.data,
      fileName: fileNameMatch?.[1] ?? "mifbems-backup.json.enc"
    };
  }
};
