import {
  ArrowUpRight,
  BedDouble,
  CreditCard,
  TrendingUp,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { name: "1 Jun", oc: 80, rev: 4000 },
  { name: "2 Jun", oc: 85, rev: 4500 },
  { name: "3 Jun", oc: 90, rev: 5000 },
  { name: "4 Jun", oc: 95, rev: 5200 },
  { name: "5 Jun", oc: 100, rev: 6000 },
  { name: "6 Jun", oc: 100, rev: 6200 },
  { name: "7 Jun", oc: 85, rev: 4800 },
];

export function Dashboard() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Today's operational and financial overview.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow p-6">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Today's Occupancy</h3>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">85%</div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <span className="text-green-500 flex items-center"><ArrowUpRight size={12}/> 2%</span>
            vs yesterday
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card text-card-foreground shadow p-6">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Arrivals</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">12</div>
          <p className="text-xs text-muted-foreground mt-1">
            4 completed, 8 pending
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card text-card-foreground shadow p-6">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Monthly Revenue</h3>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">$124,500</div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <span className="text-green-500 flex items-center"><ArrowUpRight size={12}/> 15%</span>
            vs previous month
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card text-card-foreground shadow p-6">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">ADR</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">$450</div>
          <p className="text-xs text-muted-foreground mt-1">
            Per occupied room
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow col-span-4 p-6">
          <h3 className="font-semibold text-lg mb-4">Revenue and Occupancy (7 days)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C98A3C" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#C98A3C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={value => `$${value}`} />
                <Tooltip />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EADDCB" />
                <Area type="monotone" dataKey="rev" stroke="#C98A3C" fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card text-card-foreground shadow col-span-3 p-6">
          <h3 className="font-semibold text-lg mb-4">Operational Tasks</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="font-medium text-sm">Room Cleaning</p>
                <p className="text-xs text-muted-foreground">Housekeeping</p>
              </div>
              <div className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-bold">
                5 Pending
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="font-medium text-sm">Prepare Honeymoon Setup</p>
                <p className="text-xs text-muted-foreground">Room 202</p>
              </div>
              <div className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">
                Urgent
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="font-medium text-sm">AC Inspection</p>
                <p className="text-xs text-muted-foreground">Maintenance (Room 103)</p>
              </div>
              <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">
                Completed
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
