import { WorkerShell } from "@/components/worker/WorkerShell";

export default function TripsLayout({ children }: LayoutProps<"/trips">) {
  return <WorkerShell>{children}</WorkerShell>;
}
