interface Props {
  title: string;
  value: string;
  helper?: string;
  tone?: "blue" | "emerald" | "amber" | "violet";
}

const toneStyles = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
};

export default function DashboardCard({
  title,
  value,
  helper = "Aguardando integração de dados",
  tone = "blue",
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <strong className="mt-2 block text-3xl font-bold tracking-tight text-slate-950">{value}</strong>
        </div>
        <span className={`h-10 w-10 rounded-xl ring-1 ${toneStyles[tone]}`} aria-hidden="true" />
      </div>
      <p className="mt-4 text-xs text-slate-400">{helper}</p>
    </div>
  );
}
