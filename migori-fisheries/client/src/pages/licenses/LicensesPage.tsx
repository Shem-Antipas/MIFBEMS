import { useLicenses } from "@/hooks/useLicenses";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";

const LicensesPage = () => {
  const { data: licenses = [], isLoading } = useLicenses();

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Licenses</h1>
      <DataTable
        headers={["License No", "Farmer", "Type", "Issued", "Expiry", "Status"]}
        rows={licenses.map((license) => [
          license.licenseNo,
          license.farmer?.name ?? "-",
          license.type,
          new Date(license.issuedDate).toLocaleDateString(),
          new Date(license.expiryDate).toLocaleDateString(),
          <StatusBadge key={license.id} status={license.status} />
        ])}
        emptyLabel={isLoading ? "Loading licenses..." : "No licenses found."}
      />
    </section>
  );
};

export default LicensesPage;
