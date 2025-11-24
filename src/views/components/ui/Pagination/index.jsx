import IconLink from "@/views/components/ui/IconLink";
import styles from "./styles.module.css";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (!totalPages || totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust range if near the start
      if (currentPage <= 3) {
        start = 2;
        end = 4;
      }

      // Adjust range if near the end
      if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
        end = totalPages - 1;
      }

      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push("...");
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={styles.pagination}>
      <IconLink
        asButton
        icon="Back"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      />
      <div className={styles.pageNumbers}>
        {pageNumbers.map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === "number" && onPageChange(page)}
            disabled={page === "..." || page === currentPage}
            className={`${styles.pageButton} ${
              page === currentPage ? styles.active : ""
            } ${page === "..." ? styles.ellipsis : ""}`}
          >
            {page}
          </button>
        ))}
      </div>
      <IconLink
        asButton
        disabled={currentPage === totalPages}
        icon="Forward"
        onClick={() => onPageChange(currentPage + 1)}
      />
    </div>
  );
};

export default Pagination;
