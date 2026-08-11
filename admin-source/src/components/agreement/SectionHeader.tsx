
interface SectionHeaderProps { title: string; }
export default function SectionHeader({ title }: SectionHeaderProps) {
  return <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-700 border-b pb-2">{title}</h3>;
}

