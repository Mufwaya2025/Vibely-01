import React, { useEffect, useMemo, useState } from "react";
import { EventCategory } from "../types";
import { EVENT_CATEGORIES } from "../constants";
import ListIcon from "./icons/ListIcon";
import MapIcon from "./icons/MapIcon";

export interface Filters {
  query: string;
  category: EventCategory | "All";
  date: string; // 'all' | 'today' | 'this_week' | 'this_month' | ISO string
  price: "all" | "free" | "paid";
}

interface FilterBarProps {
  onFilterChange: (filters: Filters) => void;
  filters: Filters;
  viewMode: "list" | "map";
  onViewModeChange: (mode: "list" | "map") => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  filters,
  viewMode,
  onViewModeChange,
}) => {
  const presetValues = ["all", "today", "this_week", "this_month"] as const;
  type DatePreset = typeof presetValues[number] | "custom";

  const derivePreset = (value: Filters["date"]): DatePreset => {
    if (presetValues.includes(value as (typeof presetValues)[number])) {
      return value as DatePreset;
    }
    return value && value !== "all" ? "custom" : "all";
  };

  const deriveCustomDate = (value: Filters["date"]) => {
    return presetValues.includes(value as (typeof presetValues)[number]) || value === "all"
      ? ""
      : value ?? "";
  };

  const [datePreset, setDatePreset] = useState<DatePreset>(() => derivePreset(filters.date));
  const [customDate, setCustomDate] = useState(() => deriveCustomDate(filters.date));
  const [isCustomPending, setIsCustomPending] = useState(
    () => derivePreset(filters.date) === "custom" && !deriveCustomDate(filters.date)
  );

  useEffect(() => {
    const presetFromFilters = derivePreset(filters.date);

    if (!(isCustomPending && presetFromFilters === "all")) {
      setDatePreset(presetFromFilters);
    }

    if (presetFromFilters === "custom") {
      setCustomDate(deriveCustomDate(filters.date));
      setIsCustomPending(false);
    } else {
      if (!isCustomPending) {
        setCustomDate("");
      }
      setIsCustomPending(false);
    }
  }, [filters.date, isCustomPending]);

  const todayIso = useMemo(() => {
    const date = new Date();
    return date.toISOString().split("T")[0];
  }, []);

  const updateFilters = (next: Partial<Filters>) => {
    onFilterChange({ ...filters, ...next });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    updateFilters({ [name]: value } as Partial<Filters>);
  };

  const handlePresetChange = (preset: DatePreset) => {
    if (preset === "custom") {
      setDatePreset("custom");
      setIsCustomPending(true);
      const existingCustom = deriveCustomDate(filters.date);
      setCustomDate(existingCustom);
      if (!existingCustom) {
        updateFilters({ date: "all" });
      }
    } else {
      setIsCustomPending(false);
      setDatePreset(preset);
      setCustomDate("");
      updateFilters({ date: preset });
    }
  };

  const handleCustomDateChange = (value: string) => {
    setCustomDate(value);
    setIsCustomPending(false);
    updateFilters({ date: value || "all" });
  };

  const handleCategoryClick = (category: EventCategory | "All") => {
    updateFilters({ category });
  };

  const presetOptions: { value: DatePreset; label: string }[] = [
    { value: "all", label: "Any Date" },
    { value: "today", label: "Today" },
    { value: "this_week", label: "This Week" },
    { value: "this_month", label: "This Month" },
    { value: "custom", label: "Custom Date" },
  ];

  return (
    <div className="mb-10 rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-100/80">
      <div className="flex flex-wrap items-center gap-5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="text"
            name="query"
            value={filters.query}
            onChange={handleInputChange}
            placeholder="Search for events..."
            className="w-full rounded-full border border-slate-200 bg-slate-50/60 py-3 pl-12 pr-4 text-sm text-slate-700 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-300">
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4">
          {/* Date Controls */}
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Date
            </span>
            <div className="flex items-center gap-2">
              <select
                value={datePreset}
                onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
                className="w-32 appearance-none rounded-lg border-none bg-transparent text-sm font-semibold text-slate-700 focus:outline-none focus:ring-0"
              >
                {presetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {datePreset === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => handleCustomDateChange(e.target.value)}
                  min={todayIso}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
                />
              )}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => onViewModeChange("list")}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "list"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <ListIcon className="h-4 w-4" />
              <span>List</span>
            </button>
            <button
              onClick={() => onViewModeChange("map")}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "map"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <MapIcon className="h-4 w-4" />
              <span>Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
        {(["All", ...EVENT_CATEGORIES] as (EventCategory | "All")[]).map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              filters.category === cat
                ? "bg-purple-600 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilterBar;
