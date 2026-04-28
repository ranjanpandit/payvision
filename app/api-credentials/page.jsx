import Shell from "@/components/payvision/Shell";

export default function ApiCredentialsPage() {
  return (
    <Shell title="API Credentials" breadcrumb="Home > API Credentials">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-700">
          API credential details can be managed from your merchant profile for now.
        </p>
      </div>
    </Shell>
  );
}
