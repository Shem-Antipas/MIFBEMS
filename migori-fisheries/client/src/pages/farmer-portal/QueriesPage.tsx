import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { queriesApi } from "@/api/queries";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { QueryRecord } from "@/types";

interface QueryForm {
  subject: string;
  message: string;
}

const queryExportColumns = [
  { header: "Subject", value: "subject" },
  { header: "Message", value: "message" },
  { header: "Status", value: "status" },
  { header: "Reply", value: (query: QueryRecord) => query.reply ?? "" },
  { header: "Created At", value: (query: QueryRecord) => new Date(query.createdAt) },
  { header: "Updated At", value: (query: QueryRecord) => new Date(query.updatedAt) }
] satisfies Array<ExcelColumn<QueryRecord>>;

const QueriesPage = () => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<QueryForm>();

  const { data: queries = [], isLoading } = useQuery({
    queryKey: ["queries"],
    queryFn: queriesApi.list
  });

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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">My Queries</h1>
        <ExportButton
          filename="queries"
          sheetName="Queries"
          columns={queryExportColumns}
          rows={queries}
        />
      </div>

      <form
        className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2"
        onSubmit={handleSubmit((values) => createQuery.mutate(values))}
      >
        <input
          {...register("subject", { required: true })}
          placeholder="Subject"
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <input
          {...register("message", { required: true })}
          placeholder="Message"
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="md:col-span-2 w-fit rounded-lg bg-primary px-3 py-2 text-sm text-white"
          disabled={createQuery.isPending}
        >
          {createQuery.isPending ? "Submitting..." : "Submit Query"}
        </button>
      </form>

      <DataTable
        headers={["Subject", "Message", "Status", "Reply"]}
        rows={queries.map((item) => [
          item.subject,
          item.message,
          <StatusBadge key={item.id} status={item.status} />,
          item.reply ?? "Pending"
        ])}
        emptyLabel={isLoading ? "Loading queries..." : "No queries submitted yet."}
      />
    </section>
  );
};

export default QueriesPage;
