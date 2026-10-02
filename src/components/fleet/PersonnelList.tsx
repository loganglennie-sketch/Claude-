"use client";

import { useState } from "react";
import { rankOrder } from "@/config/vessel";
import { useFleet } from "@/lib/vessel/store";
import { Card } from "../ui";

/**
 * STAGE 1: the company-wide personnel list, read-only.
 * Adding, editing and importing from Excel come in stage 5.
 */
export function PersonnelList() {
  const { people } = useFleet();
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const list = people
    .filter((p) => !q || `${p.name} ${p.role} ${p.agency ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => rankOrder(a.role) - rankOrder(b.role) || a.name.localeCompare(b.name));
  const agency = people.filter((p) => p.employment === "agency").length;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 pb-10 pt-4">
      <div>
        <h1 className="text-2xl font-bold">Personnel</h1>
        <p className="text-muted">
          {people.length} people · {people.length - agency} staff · {agency} agency
        </p>
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, rank or agency"
        className="min-h-12 w-full max-w-sm rounded-xl border-2 border-line bg-surface px-3 focus:border-brand focus:outline-none"
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Rank</th>
              <th className="px-4 py-2">Staff / agency</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-semibold">{p.name}</td>
                <td className="px-4 py-2">{p.role}</td>
                <td className="px-4 py-2">{p.employment === "agency" ? `Agency – ${p.agency ?? ""}` : "Staff"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
