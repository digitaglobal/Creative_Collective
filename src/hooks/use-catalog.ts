import { useQuery } from "@tanstack/react-query";
import { services, brands, type Service, type Brand, DEMO_MODE } from "@/data/catalog";
import { backendConfigured, rpc } from "@/lib/supabase";

export interface Catalog {
  services: Service[];
  brands: Brand[];
  rules: { horizonDays: number; advanceNoticeHours: number };
  ready: boolean;
  taxBasisPoints?: number | null;
  hours?: {
    weekdayOpen: string;
    weekdayClose: string;
    saturdayOpen: string;
    saturdayClose: string;
    sundayClosed: boolean;
  };
}
export function useCatalog() {
  return useQuery<Catalog>({
    queryKey: ["catalog"],
    queryFn: () =>
      backendConfigured
        ? rpc<Catalog>("public_catalog")
        : Promise.resolve({
            services: DEMO_MODE ? services : [],
            brands,
            rules: { horizonDays: 90, advanceNoticeHours: 4 },
            ready: false,
          }),
    staleTime: 60_000,
  });
}
