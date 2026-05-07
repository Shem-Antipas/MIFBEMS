import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { queriesApi } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ExcelColumn } from "@/lib/exportToExcel";
import { getSearchEmptyLabel } from "@/lib/search";
import { useAuthStore } from "@/store/authStore";
import type { QueryRecord } from "@/types";

interface QueryForm {
  subject: string;
  message: string;
}

const queryExportColumns = [
  { header: "Subject", value: "subject" },
  { header: "Farmer", value: (query: QueryRecord) => query.user?.name ?? "" },
  { header: "Sub-County", value: (query: QueryRecord) => query.user?.subCounty ?? "" },
  { header: "Message", value: "message" },
  { header: "Status", value: "status" },
  { header: "Reply", value: (query: QueryRecord) => query.reply ?? "" },
  { header: "Replied By", value: (query: QueryRecord) => query.replyByName ?? "" },
  { header: "Created At", value: (query: QueryRecord) => new Date(query.createdAt) },
  { header: "Updated At", value: (query: QueryRecord) => new Date(query.updatedAt) }
] satisfies Array<ExcelColumn<QueryRecord>>;

const QueriesPage = () => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<QueryForm>();
  const user = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | QueryRecord["status"]>("ALL");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const { data: queries = [], isLoading } = useQuery({
    queryKey: ["queries"],
    queryFn: queriesApi.list
  });

  const canReply = user?.role === "FISHERIES_OFFICER" || user?.role === "DIRECTOR" || user?.role === "ADMIN";
  const isFarmer = user?.role === "FARMER";

  const createQuery = useMutation({
    mutationFn: queriesApi.create,
    onSuccess: () => {
      toast.success("Query submitted");
      reset();
      void queryClient.invalidateQueries({ queryKey: ["queries"] });
    },
    onError: () => {
      toast.error("Unable to submit query");
    }
  });

  const replyToQuery = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => queriesApi.reply(id, { reply, status: "RESOLVED" }),
    onSuccess: (_data, variables) => {
      toast.success("Query response sent to the farmer");
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["queries"] });
      void queryClient.invalidateQueries({ queryKey: ["advisories"] });
    },
    onError: (error) => {
      const message =
        (error as AxiosError<{ error?: string }>).response?.data?.error ??
        "Unable to send query response";
      toast.error(message);
    }
  });

  const filteredQueries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return queries.filter((query) => {
      const matchesStatus = statusFilter === "ALL" || query.status === statusFilter;
      const matchesSearch =
        !term ||
        [
          query.subject,
          query.message,
          query.reply ?? "",
          query.replyByName ?? "",
          query.status,
          query.user?.name ?? "",
          query.user?.email ?? "",
          query.user?.subCounty ?? ""
        ].some((value) => value.toLowerCase().includes(term));

      return matchesStatus && matchesSearch;
    });
  }, [queries, searchTerm, statusFilter]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{isFarmer ? "My Queries" : "Farmer Queries"}</h1>
          <p className="text-sm text-muted-foreground">
            {isFarmer
              ? "Submit questions and view responses from your fisheries officer."
              : "Review and respond to farmer queries assigned by sub-county."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search queries..."
            className="w-56"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <ExportButton
            filename="queries"
            sheetName="Queries"
            columns={queryExportColumns}
            rows={filteredQueries}
          />
        </div>
      </div>

      {isFarmer ? (
        <form
          className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2"
          onSubmit={handleSubmit((values) => createQuery.mutate(values))}
        >
          <Input
            {...register("subject", { required: true })}
            placeholder="Subject"
          />
          <Input
            {...register("message", { required: true })}
            placeholder="Message"
          />
          <Button
            type="submit"
            className="md:col-span-2 w-fit"
            disabled={createQuery.isPending}
          >
            {createQuery.isPending ? "Submitting..." : "Submit Query"}
          </Button>
        </form>
      ) : null}

      <DataTable
        headers={isFarmer ? ["Subject", "Message", "Status", "Reply", "Replied By"] : ["Farmer", "Sub-County", "Subject", "Message", "Status", "Reply / Action"]}
        rows={filteredQueries.map((item) => isFarmer ? [
          item.subject,
          item.message,
          <StatusBadge key={item.id} status={item.status} />,
          item.reply ?? "Pending",
          item.replyByName ?? "-"
        ] : [
          item.user?.name ?? "-",
          item.user?.subCounty ?? "-",
          item.subject,
          item.message,
          <StatusBadge key={item.id} status={item.status} />,
          <div key={`${item.id}-reply`} className="min-w-80 space-y-2">
            {item.reply ? (
              <div className="rounded-md border bg-muted/20 p-2 text-sm">
                <p>{item.reply}</p>
                <p className="mt-1 text-xs text-muted-foreground">By {item.replyByName ?? "Fisheries Office"}</p>
              </div>
            ) : null}
            {canReply && item.status === "PENDING" ? (
              <div className="flex gap-2">
                <Input
                  value={replyDrafts[item.id] ?? ""}
                  onChange={(event) => setReplyDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  placeholder="Type response to farmer..."
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={replyToQuery.isPending || !(replyDrafts[item.id] ?? "").trim()}
                  onClick={() => void replyToQuery.mutate({ id: item.id, reply: (replyDrafts[item.id] ?? "").trim() })}
                >
                  Reply
                </Button>
              </div>
            ) : null}
          </div>
        ])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm: searchTerm || (statusFilter !== "ALL" ? "selected filters" : ""),
          isLoading,
          loadingLabel: "Loading queries...",
          emptyLabel: isFarmer ? "No queries submitted yet." : "No farmer queries found."
        })}
      />
    </section>
  );
};

export default QueriesPage;
