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
        className="input"
        placeholder="サービス名を入力（例：ネトフリ）"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
      />

      {showResults && query.trim() && (
        <div
          className="absolute z-10 w-full"
          style={{
            marginTop: 4,
            background: "#fff",
            border: "1px solid var(--hair)",
            borderRadius: 8,
            boxShadow: "0 6px 28px rgba(95, 107, 94, 0.12)",
            overflow: "hidden",
          }}
        >
          {results.length > 0 ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full text-left hover:bg-zinc-50"
                    style={{
                      padding: "11px 13px",
                      fontSize: 15,
                      color: "var(--ink)",
                    }}
                    onClick={() => {
                      setQuery(r.canonicalName);
                      setShowResults(false);
                      onSelect(r);
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{r.canonicalName}</span>
                    <span className="caption" style={{ marginLeft: 8 }}>
                      {r.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="w-full text-left hover:bg-zinc-50"
            style={{
              padding: "11px 13px",
              fontSize: 14,
              color: "var(--faint)",
              borderTop: "1px solid var(--hair)",
            }}
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
