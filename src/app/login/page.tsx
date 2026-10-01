import { LoginScreen } from "@/components/LoginScreen";

export default function LoginPage() {
  return (
    <>
      {/* Brand stripe: main colour with the accent colour at the end. */}
      <div aria-hidden className="flex h-2 w-full">
        <div className="flex-[3] bg-brand" />
        <div className="flex-1 bg-accent" />
      </div>
      <LoginScreen />
    </>
  );
}
