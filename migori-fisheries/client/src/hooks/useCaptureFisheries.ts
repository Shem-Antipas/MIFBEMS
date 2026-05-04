import { useQuery } from "@tanstack/react-query";
import { captureFisheriesApi } from "@/api/captureFisheries";

export const useCaptureFisheries = () => {
  return useQuery({
    queryKey: ["capture-fisheries"],
    queryFn: captureFisheriesApi.list
  });
};
