import PageLoader from "@/views/components/layout/PageLoader";

// Shown inside the dashboard layout (the sidebar stays) while a page loads on the server
export default function DashboardLoading() {
  return <PageLoader />;
}
