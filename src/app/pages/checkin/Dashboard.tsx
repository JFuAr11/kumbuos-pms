import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, CheckCircle2, Filter, Globe2, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppContext } from "../../context/AppContext";

type MetricMode = "count" | "percentage";

const ageBands = [
  { id: "0-10", label: "0-10", min: 0, max: 10 },
  { id: "11-20", label: "11-20", min: 11, max: 20 },
  { id: "21-30", label: "21-30", min: 21, max: 30 },
  { id: "31-40", label: "31-40", min: 31, max: 40 },
  { id: "41-50", label: "41-50", min: 41, max: 50 },
  { id: "51-60", label: "51-60", min: 51, max: 60 },
  { id: "61-70", label: "61-70", min: 61, max: 70 },
  { id: "71-80", label: "71-80", min: 71, max: 80 },
  { id: "81-90", label: "81-90", min: 81, max: 90 },
  { id: "90<", label: "90<", min: 91, max: Number.POSITIVE_INFINITY },
];

export function CheckInDashboard() {
  const { checkInSubmissions, selectedPropertyId } = useAppContext();
  const [metricMode, setMetricMode] = useState<MetricMode>("count");
  const [nationalityFilter, setNationalityFilter] = useState("All");
  const [selectedAgeBands, setSelectedAgeBands] = useState<string[]>(["All"]);

  const propertySubmissions = useMemo(() => (
    checkInSubmissions.filter(submission => submission.propertyId === selectedPropertyId)
  ), [checkInSubmissions, selectedPropertyId]);

  const enrichedSubmissions = useMemo(() => propertySubmissions.map(submission => {
    const age = calculateAge(submission.dateOfBirth);
    const band = age === null ? "Unknown" : getAgeBand(age);
    return {
      ...submission,
      nationality: submission.countryOfNationality || "Unknown",
      age,
      ageBand: band,
    };
  }), [propertySubmissions]);

  const nationalities = useMemo(() => (
    Array.from(new Set(enrichedSubmissions.map(item => item.nationality))).sort((a, b) => a.localeCompare(b))
  ), [enrichedSubmissions]);

  const ageBandFilterSet = selectedAgeBands.includes("All") ? null : new Set(selectedAgeBands);

  const filteredSubmissions = useMemo(() => enrichedSubmissions.filter(submission => {
    if (nationalityFilter !== "All" && submission.nationality !== nationalityFilter) return false;
    if (ageBandFilterSet && !ageBandFilterSet.has(submission.ageBand)) return false;
    return true;
  }), [ageBandFilterSet, enrichedSubmissions, nationalityFilter]);

  const nationalityRows = useMemo(() => {
    const total = filteredSubmissions.length || 1;
    const groups = new Map<string, { nationality: string; guests: number; percentage: number }>();
    filteredSubmissions.forEach(submission => {
      const current = groups.get(submission.nationality) || { nationality: submission.nationality, guests: 0, percentage: 0 };
      current.guests += 1;
      groups.set(submission.nationality, current);
    });
    return Array.from(groups.values())
      .map(row => ({ ...row, percentage: roundPercent((row.guests / total) * 100), value: metricMode === "count" ? row.guests : roundPercent((row.guests / total) * 100) }))
      .sort((left, right) => right.guests - left.guests);
  }, [filteredSubmissions, metricMode]);

  const marketingRows = useMemo(() => {
    const groups = new Map<string, { nationality: string; total: number; accepted: number; percentage: number; value: number }>();
    filteredSubmissions.forEach(submission => {
      const current = groups.get(submission.nationality) || { nationality: submission.nationality, total: 0, accepted: 0, percentage: 0, value: 0 };
      current.total += 1;
      current.accepted += submission.marketingConsent ? 1 : 0;
      groups.set(submission.nationality, current);
    });
    return Array.from(groups.values())
      .map(row => ({
        ...row,
        percentage: row.total ? roundPercent((row.accepted / row.total) * 100) : 0,
        value: metricMode === "count" ? row.accepted : row.total ? roundPercent((row.accepted / row.total) * 100) : 0,
      }))
      .sort((left, right) => right.accepted - left.accepted);
  }, [filteredSubmissions, metricMode]);

  const ageRows = useMemo(() => {
    const ageBase = enrichedSubmissions.filter(submission => nationalityFilter === "All" || submission.nationality === nationalityFilter);
    const knownAgeBase = ageBase.filter(submission => submission.ageBand !== "Unknown");
    const total = knownAgeBase.length || 1;
    return ageBands.map(band => {
      const guests = knownAgeBase.filter(submission => submission.ageBand === band.id).length;
      const percentage = roundPercent((guests / total) * 100);
      return {
        band: band.label,
        guests,
        percentage,
        value: metricMode === "count" ? guests : percentage,
      };
    });
  }, [enrichedSubmissions, metricMode, nationalityFilter]);

  const totalFiltered = filteredSubmissions.length;
  const marketingAccepted = filteredSubmissions.filter(submission => submission.marketingConsent).length;
  const marketingAcceptedPercent = totalFiltered ? roundPercent((marketingAccepted / totalFiltered) * 100) : 0;
  const missingDateOfBirth = filteredSubmissions.filter(submission => submission.ageBand === "Unknown").length;

  const toggleAgeBand = (bandId: string) => {
    if (bandId === "All") {
      setSelectedAgeBands(["All"]);
      return;
    }
    setSelectedAgeBands(current => {
      const withoutAll = current.filter(item => item !== "All");
      const next = withoutAll.includes(bandId)
        ? withoutAll.filter(item => item !== bandId)
        : [...withoutAll, bandId];
      return next.length ? next : ["All"];
    });
  };

  return (
    <div data-pdf-export-root className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Guest intelligence</p>
        <h1 className="text-3xl font-bold text-foreground">Check-in Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Official Check-in Database analytics for nationality, marketing consent, and guest age bands.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Dashboard Filters</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[260px_260px_1fr]">
          <label className="space-y-2 text-sm font-medium">
            View Values As
            <select className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm" value={metricMode} onChange={event => setMetricMode(event.target.value as MetricMode)}>
              <option value="count">Number of guests</option>
              <option value="percentage">Percentage of guests</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Nationality
            <select className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm" value={nationalityFilter} onChange={event => setNationalityFilter(event.target.value)}>
              <option value="All">All</option>
              {nationalities.map(nationality => <option key={nationality} value={nationality}>{nationality}</option>)}
            </select>
          </label>
          <div className="space-y-2 text-sm font-medium">
            Age Bands
            <div className="flex flex-wrap gap-2">
              <AgeToggle active={selectedAgeBands.includes("All")} label="All" onClick={() => toggleAgeBand("All")} />
              {ageBands.map(band => (
                <AgeToggle key={band.id} active={selectedAgeBands.includes(band.id)} label={band.label} onClick={() => toggleAgeBand(band.id)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Filtered Guests" value={totalFiltered} />
        <MetricCard icon={Globe2} label="Nationalities" value={nationalityRows.length} />
        <MetricCard icon={CheckCircle2} label="Marketing Agree" value={`${marketingAcceptedPercent}%`} note={`${marketingAccepted} guests accepted`} tone="positive" />
        <MetricCard icon={BarChart3} label="Missing DOB" value={missingDateOfBirth} note="Excluded from age-band percentages" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Guests by Nationality" description="Total guest volume by nationality, shown as absolute count or share of the filtered data.">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={nationalityRows.slice(0, 12)} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nationality" angle={-35} textAnchor="end" interval={0} height={80} />
              <YAxis />
              <Tooltip formatter={(value: number) => formatMetric(value, metricMode)} />
              <Bar dataKey="value" name={metricMode === "count" ? "Guests" : "Guests %"} fill="#c98736" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Marketing Consent by Nationality" description="Guests with marketing consent by nationality. Percentage mode shows consent rate within each nationality.">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={marketingRows.slice(0, 12)} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nationality" angle={-35} textAnchor="end" interval={0} height={80} />
              <YAxis />
              <Tooltip formatter={(value: number) => formatMetric(value, metricMode)} />
              <Legend />
              <Bar dataKey="value" name={metricMode === "count" ? "Marketing Agree" : "Consent %"} fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <ChartPanel title="Guest Age Bands" description="Age-band distribution for the selected nationality. The age-band filter is intentionally not applied here so every band remains visible.">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={ageRows} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="band" />
            <YAxis />
            <Tooltip formatter={(value: number) => formatMetric(value, metricMode)} />
            <Bar dataKey="value" name={metricMode === "count" ? "Guests" : "Guests %"} fill="#5f5443" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5">
          <h2 className="text-xl font-semibold">Filtered Guest Data</h2>
          <p className="text-sm text-muted-foreground">Rows feeding the dashboard charts for the active property.</p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Guest</th>
                <th className="p-3">Nationality</th>
                <th className="p-3">DOB</th>
                <th className="p-3">Age Band</th>
                <th className="p-3">Marketing</th>
                <th className="p-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.slice(0, 120).map(submission => (
                <tr key={submission.id} className="border-t border-border">
                  <td className="p-3 font-medium">{submission.fullName}</td>
                  <td className="p-3">{submission.nationality}</td>
                  <td className="p-3">{submission.dateOfBirth || "-"}</td>
                  <td className="p-3">{submission.ageBand}</td>
                  <td className="p-3">{submission.marketingConsent ? "Agree" : "Not agreed"}</td>
                  <td className="p-3">{formatSubmittedDate(submission.submissionTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredSubmissions.length && <div className="p-6 text-sm text-muted-foreground">No Check-in Database records match the current filters.</div>}
        </div>
      </section>
    </div>
  );
}

function AgeToggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/60"}`}
    >
      {label}
    </button>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone = "neutral" }: { icon: typeof Users; label: string; value: string | number; note?: string; tone?: "neutral" | "positive" }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`mt-3 text-3xl font-bold ${tone === "positive" ? "text-green-600" : "text-foreground"}`}>{value}</p>
          {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </div>
    </section>
  );
}

function ChartPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function calculateAge(dateOfBirth: string) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function getAgeBand(age: number) {
  return ageBands.find(band => age >= band.min && age <= band.max)?.id || "Unknown";
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function formatMetric(value: number, mode: MetricMode) {
  return mode === "percentage" ? `${value}%` : `${value} guests`;
}

function formatSubmittedDate(value: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}
