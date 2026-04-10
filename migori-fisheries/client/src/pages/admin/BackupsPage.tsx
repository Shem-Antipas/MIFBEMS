const BackupsPage = () => {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">System Backups</h1>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-muted-foreground">
          Trigger ad-hoc backups and download the latest encrypted archive.
        </p>
        <div className="mt-4 flex gap-2">
          <button className="rounded-lg bg-primary px-3 py-2 text-sm text-white">Run Backup</button>
          <button className="rounded-lg border px-3 py-2 text-sm">Download Latest</button>
        </div>
      </div>
    </section>
  );
};

export default BackupsPage;
