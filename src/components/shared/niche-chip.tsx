import { humanize } from "@/lib/constants";

export function NicheChip({ niche }: { niche: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
      {humanize(niche)}
    </span>
  );
}
