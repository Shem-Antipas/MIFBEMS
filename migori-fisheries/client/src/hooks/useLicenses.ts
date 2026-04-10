import { useQuery } from "@tanstack/react-query";
import { licensesApi } from "@/api/licenses";

export const useLicenses = () => {
  return useQuery({
    queryKey: ["licenses"],
    queryFn: licensesApi.list
  });
};
