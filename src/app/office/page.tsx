import { OfficeLoginScreen } from "@/components/OfficeLoginScreen";

export default function OfficeLoginPage() {
  return (
    <>
      <div aria-hidden className="flex h-2 w-full">
        <div className="flex-[3] bg-brand" />
        <div className="flex-1 bg-accent" />
      </div>
      <OfficeLoginScreen />
    </>
  );
}
