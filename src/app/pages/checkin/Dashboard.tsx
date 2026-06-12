import { useAppContext } from "../../context/AppContext";

export function CheckInDashboard() {
  const { clients } = useAppContext();

  const totalClients = clients.length;
  
  const nationalityCount = clients.reduce((acc, client) => {
    const nat = client.nationality || 'Unknown';
    acc[nat] = (acc[nat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const optInCount = clients.filter(c => c.marketingOptIn).length;
  const optInPercent = totalClients > 0 ? Math.round((optInCount / totalClients) * 100) : 0;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Check-in Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Clients</p>
          <p className="text-4xl font-bold">{totalClients}</p>
        </div>
        
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Marketing Opt-in</p>
          <p className="text-4xl font-bold text-green-600">{optInPercent}%</p>
          <p className="text-sm text-muted-foreground mt-2">{optInCount} clients accepted</p>
        </div>
      </div>

      <div className="bg-card border border-border p-6 rounded-xl shadow-sm max-w-2xl">
        <h2 className="text-xl font-bold mb-4">Nationalities</h2>
        <div className="space-y-4">
          {Object.entries(nationalityCount).sort((a, b) => b[1] - a[1]).map(([nat, count]) => (
            <div key={nat}>
              <div className="flex justify-between mb-1 text-sm">
                <span className="font-medium">{nat}</span>
                <span className="text-muted-foreground">{count} clients</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${(count / totalClients) * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}