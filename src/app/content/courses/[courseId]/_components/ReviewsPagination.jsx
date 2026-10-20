"use client";

import Pagination from "@/views/components/ui/Pagination";
import { usePathname, useRouter } from "next/navigation";

/**
 * Pages of the course reviews. The page lives in the URL (`?page=`, left out for page 1),
 * so moving re-renders the Server Component with that page.
 */
const ReviewsPagination = ({ page, totalPages }) => {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Pagination
      currentPage={page}
      label="Paginación de reseñas"
      totalPages={totalPages}
      onPageChange={(next) => router.push(next > 1 ? `${pathname}?page=${next}` : pathname, { scroll: false })}
    />
  );
};

export default ReviewsPagination;
