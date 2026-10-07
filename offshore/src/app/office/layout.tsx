import { OfficeShell } from "@/components/office/OfficeShell";

export default function OfficeLayout({ children }: LayoutProps<"/office">) {
  return <OfficeShell>{children}</OfficeShell>;
}
