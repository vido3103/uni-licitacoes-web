interface Props {
  title: string;
  value: string;
}

export default function DashboardCard({
  title,
  value,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <p className="text-gray-500 text-sm">
        {title}
      </p>

      <strong className="text-3xl">
        {value}
      </strong>
    </div>
  );
}