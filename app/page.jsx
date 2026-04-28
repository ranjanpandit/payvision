import Shell from "@/components/payvision/Shell";
import { getProviderBalance } from "@/lib/payvision";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";

function StatCard({ title, value, color }) {
  return (
    <div className={`rounded-2xl p-5 text-white ${color}`}>
      <p className="text-sm opacity-90">{title}</p>
      <p className="text-4xl mt-2 font-bold">Rs {value}</p>
    </div>
  );
}

export default async function HomePage() {
  const sessionUser = await getSessionUserFromCookies().catch(() => null);
  const isClient = sessionUser?.role === "CLIENT";
  const merchantId = String(sessionUser?.merchantId || "").trim();

  const balance = await getProviderBalance({ revalidateSeconds: 60 }).catch(() => null);
  const adminPayoutBalance =
    balance && balance.ok ? balance.payoutTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

  const [merchantWallet, walletTotals] = await Promise.all([
    isClient && merchantId
      ? prisma.merchantWalletBalance.findUnique({
          where: { merchantId },
          select: { payinBalance: true, payoutBalance: true },
        })
      : Promise.resolve(null),
    !isClient
      ? prisma.merchantWalletBalance.aggregate({
          _sum: {
            payinBalance: true,
            payoutBalance: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const merchantPayinBalance = Number(merchantWallet?.payinBalance || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const merchantPayoutBalance = Number(merchantWallet?.payoutBalance || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const totalMerchantPayoutBalance = Number(walletTotals?._sum?.payoutBalance || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const totalMerchantPayinBalance = Number(walletTotals?._sum?.payinBalance || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Shell title="Dashboard" breadcrumb="Home > Dashboard > Filters">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium">From Date *</label>
            <input type="date" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium">To Date *</label>
            <input type="date" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium">Merchant ID *</label>
            <select className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2">
              <option>-Please Select-</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Provider *</label>
            <select className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2">
              <option>-Please Select-</option>
              <option>OpenMoney</option>
            </select>
          </div>
        </div>
        <button type="button" className="mt-4 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-6 py-2 text-white font-medium">
          Search
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {isClient ? (
          <>
            <StatCard title="Your Payout Balance" value={merchantPayoutBalance} color="bg-gradient-to-r from-blue-700 to-blue-400" />
            <StatCard title="Your Paying Balance" value={merchantPayinBalance} color="bg-gradient-to-r from-violet-700 to-violet-400" />
          </>
        ) : (
          <>
            <StatCard title="Admin API Payout Balance" value={adminPayoutBalance} color="bg-gradient-to-r from-blue-700 to-blue-400" />
            <StatCard title="Total Merchant Payout Balance" value={totalMerchantPayoutBalance} color="bg-gradient-to-r from-green-700 to-green-400" />
            <StatCard title="Admin API Paying Balance" value="0.00" color="bg-gradient-to-r from-orange-700 to-orange-400" />
            <StatCard title="Total Merchant Paying Balance" value={totalMerchantPayinBalance} color="bg-gradient-to-r from-violet-700 to-violet-400" />
          </>
        )}
      </div>
    </Shell>
  );
}
