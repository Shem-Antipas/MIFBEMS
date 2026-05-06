import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { backupsApi } from "@/api/backups";
import { Button } from "@/components/ui/button";

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  (error as AxiosError<{ error?: string }>).response?.data?.error ?? fallback;

const BackupsPage = () => {
  const queryClient = useQueryClient();

  const { data: latestBackup, isLoading } = useQuery({
    queryKey: ["backups", "latest"],
    queryFn: backupsApi.getLatest
  });

  const runBackup = useMutation({
    mutationFn: backupsApi.run,
    onSuccess: async (backup) => {
      await queryClient.invalidateQueries({ queryKey: ["backups", "latest"] });
      toast.success(`Backup created: ${backup.fileName}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to run backup."));
    }
  });

  const downloadLatest = useMutation({
    mutationFn: backupsApi.downloadLatest,
    onSuccess: ({ blob, fileName }) => {
      downloadBlob(blob, fileName);
      toast.success("Backup download started");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to download latest backup."));
    }
  });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">System Backups</h1>
        <p className="text-sm text-muted-foreground">
          Create encrypted system snapshots and download the latest archive.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium">Encrypted Backup Archive</p>
            <p className="text-sm text-muted-foreground">
              Backups include users, farmers, licenses, capture fisheries, extension services, projects, advisories, queries, and audit logs.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" disabled={runBackup.isPending} onClick={() => runBackup.mutate()}>
            {runBackup.isPending ? "Running Backup..." : "Run Backup"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={downloadLatest.isPending || !latestBackup}
            onClick={() => downloadLatest.mutate()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {downloadLatest.isPending ? "Preparing Download..." : "Download Latest"}
          </Button>
        </div>

        <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm">
          {isLoading ? (
            <p className="text-muted-foreground">Checking latest backup...</p>
          ) : latestBackup ? (
            <div className="grid gap-1 sm:grid-cols-3">
              <p>
                <span className="font-medium">Latest file:</span> {latestBackup.fileName}
              </p>
              <p>
                <span className="font-medium">Size:</span> {formatBytes(latestBackup.sizeBytes)}
              </p>
              <p>
                <span className="font-medium">Created:</span> {new Date(latestBackup.createdAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No backup has been created yet. Run a backup to enable download.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default BackupsPage;
