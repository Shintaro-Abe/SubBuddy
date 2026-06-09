"use client";

import { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";

interface CatalogEntry {
  id: string;
  canonicalName: string;
  category: string;
  usageType: string;
  commonAliases: string | null;
  isExcluded: boolean;
}

interface Props {
  onSelect: (entry: CatalogEntry) => void;
  onManualEntry: (name: string) => void;
  initialValue?: string;
}

function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60),
    );
}

export function ServiceCatalogSearch({ onSelect, onManualEntry, initialValue }: Props) {
  const [query, setQuery] = useState(initialValue ?? "");
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetch("/api/service-catalog")
      .then((r) => r.json())
      .then((d) => setCatalog(d.items.filter((i: CatalogEntry) => !i.isExcluded)))
      .catch(() => {});
  }, []);

  const fuse = useMemo(() => {
    const entries = catalog.map((c) => ({
      ...c,
      searchText: normalize(
        [c.canonicalName, c.commonAliases ?? ""].join(" "),
      ),
    }));
    return new Fuse(entries, {
      keys: ["searchText"],
      threshold: 0.4,
      minMatchCharLength: 1,
    });
  }, [catalog]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(normalize(query), { limit: 8 }).map((r) => r.item);
  }, [fuse, query]);

  return (
    <div className="relative">
      <input
        type="text"
        aria-label="サービス名"
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        placeholder="サービス名を入力（例：ネトフリ）"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
      />

      {showResults && query.trim() && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
          {results.length > 0 ? (
            <ul>
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    onClick={() => {
                      setQuery(r.canonicalName);
                      setShowResults(false);
                      onSelect(r);
                    }}
                  >
                    <span className="font-medium">{r.canonicalName}</span>
                    <span className="ml-2 text-xs text-zinc-500">{r.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="w-full border-t border-zinc-100 px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50"
            onClick={() => {
              setShowResults(false);
              onManualEntry(query);
            }}
          >
            「{query}」を新しいサービスとして登録する
          </button>
        </div>
      )}
    </div>
  );
}
