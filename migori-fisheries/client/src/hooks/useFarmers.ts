import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmersApi, type CreateFarmerPayload } from "@/api/farmers";

export const useFarmers = () => {
  return useQuery({
    queryKey: ["farmers"],
    queryFn: farmersApi.list
  });
};

export const useCreateFarmer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateFarmerPayload) => farmersApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["farmers"] });
    }
  });
};
