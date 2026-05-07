import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { advisoriesApi, type CreateAdvisoryPayload } from "@/api/advisories";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ExcelColumn } from "@/lib/exportToExcel";
import { getSearchEmptyLabel } from "@/lib/search";
import { MIGORI_SUBCOUNTIES } from "@/lib/locationData";
import { useAuthStore } from "@/store/authStore";
import type { Advisory } from "@/types";

type AdvisoryForm = {
  title: string;
  message: string;
  type: Advisory["type"];
  subCounty: string;
};

const advisoryExportColumns = [
  { header: "Title", value: "title" },
  { header: "Type", value: "type" },
  { header: "Message", value: "message" },
  { header: "From", value: "fromName" },
  { header: "Sub-County", value: (advisory: Advisory) => advisory.subCounty ?? "All" },
  { header: "Date", value: (advisory: Advisory) => new Date(advisory.createdAt) }
] satisfies Array<ExcelColumn<Advisory>>;

const AdvisoriesPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | Advisory["type"]>("ALL");
  const enforcedSubCounty = user?.role === "FISHERIES_OFFICER" ? user.subCounty : undefined;
  const canCreate = user?.role === "FISHERIES_OFFICER" || user?.role === "DIRECTOR" || user?.role === "ADMIN";

  const { register, handleSubmit, reset } = useForm<AdvisoryForm>({
    defaultValues: {
      title: "",
      message: "",
      type: "INFO",
      subCounty: enforcedSubCounty ?? ""
    }
  });

  const { data: advisories = [], isLoading } = useQuery({
    queryKey: ["advisories"],
    queryFn: advisoriesApi.list
  });

  const createAdvisory = useMutation({
    mutationFn: (payload: CreateAdvisoryPayload) => advisoriesApi.create(payload),
    onSuccess: () => {
      toast.success("Advisory sent");
      reset({ title: "", message: "", type: "INFO", subCounty: enforcedSubCounty ?? "" });
      void queryClient.invalidateQueries({ queryKey: ["advisories"] });
    },
    onError: (error) => {
      const message =
        (error as AxiosError<{ error?: string }>).response?.data?.error ??
        "Unable to send advisory.";
      toast.error(message);
    }
  });

  const filteredAdvisories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return advisories.filter((advisory) => {
      const matchesType = typeFilter === "ALL" || advisory.type === typeFilter;
      const matchesSearch =
        !term ||
        [advisory.title, advisory.message, advisory.fromName, advisory.subCounty ?? "county-wide", advisory.type].some((value) =>
          value.toLowerCase().includes(term)
        );

      return matchesType && matchesSearch;
    });
  }, [advisories, searchTerm, typeFilter]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Advisories</h1>
          <p className="text-sm text-muted-foreground">
            {canCreate ? "Send advisories and feedback to farmers." : "View advisories and responses from fisheries officers."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search advisories..."
            className="w-56"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
          >
            <option value="ALL">All types</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ACTION">Action</option>
          </select>
          <ExportButton
            filename="advisories"
            sheetName="Advisories"
            columns={advisoryExportColumns}
            rows={filteredAdvisories}
          />
        </div>
      </div>

      {canCreate ? (
        <form
          className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2"
          onSubmit={handleSubmit((values) => {
            createAdvisory.mutate({
              title: values.title.trim(),
              message: values.message.trim(),
              type: values.type,
              fromName: user?.name ?? "Fisheries Office",
              subCounty: values.subCounty || undefined
            });
          })}
        >
          <Input placeholder="Advisory title" {...register("title", { required: true })} />
          <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("type", { required: true })}>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ACTION">Action required</option>
          </select>
          <Input className="md:col-span-2" placeholder="Message to farmers" {...register("message", { required: true })} />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register("subCounty")}
            disabled={Boolean(enforcedSubCounty)}
          >
            {enforcedSubCounty ? (
              <option value={enforcedSubCounty}>{enforcedSubCounty}</option>
            ) : (
              <>
                <option value="">County-wide</option>
                {MIGORI_SUBCOUNTIES.map((subCounty) => (
                  <option key={subCounty} value={subCounty}>
                    {subCounty}
                  </option>
                ))}
              </>
            )}
          </select>
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={createAdvisory.isPending}>
              {createAdvisory.isPending ? "Sending..." : "Send Advisory"}
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        headers={["Title", "Type", "Message", "From", "Audience", "Date"]}
        rows={filteredAdvisories.map((advisory) => [
          advisory.title,
          <StatusBadge key={advisory.id} status={advisory.type} />,
          advisory.message,
          advisory.fromName,
          advisory.targetUserId ? "Direct response" : advisory.subCounty ?? "County-wide",
          new Date(advisory.createdAt).toLocaleDateString()
        ])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm: searchTerm || (typeFilter !== "ALL" ? "selected filters" : ""),
          isLoading,
          loadingLabel: "Loading advisories...",
          emptyLabel: "No advisories yet."
        })}
      />
    </section>
  );
};

export default AdvisoriesPage;
