import Link from "next/link";
import { PagedCollection } from "../../types/collection";

interface Props {
  collection: PagedCollection<unknown>;
  getPagePath: (path: string) => string;
}

const Pagination = ({ collection, getPagePath }: Props) => {
  const view = collection && collection["view"];
  if (!view) return null;
  const { first, previous, next, last } = view;

  return (
    <div className="pagination-wrap">
      <nav className="pagination-nav" aria-label="Page navigation">
        <Link href={first ? getPagePath(first) : "#"} className={previous ? "pagination-link" : "pagination-link pagination-link--disabled"} aria-label="First page">
          &#8656; First
        </Link>
        <Link href={previous ? getPagePath(previous) : "#"} className={previous ? "pagination-link" : "pagination-link pagination-link--disabled"} aria-label="Previous page">
          &#8592; Previous
        </Link>
        <Link href={next ? getPagePath(next) : "#"} className={next ? "pagination-link" : "pagination-link pagination-link--disabled"} aria-label="Next page">
          Next &#8594;
        </Link>
        <Link href={last ? getPagePath(last) : "#"} className={next ? "pagination-link" : "pagination-link pagination-link--disabled"} aria-label="Last page">
          Last &#8658;
        </Link>
      </nav>
    </div>
  );
};

export default Pagination;
