import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { exportToCSV, exportToExcel, exportToJSON } from "../../utils/export";
import { Download } from "lucide-react";

export function CheckInDatabase() {
  const { clients } = useAppContext();

  const handleExport = (type: 'csv' | 'excel' | 'json') => {
    const data = clients.map(c => ({
      ID: c.id,
      Name: c.name,
      Email: c.email,
      Phone: c.phone,
      Nationality: c.nationality,
      MarketingOptIn: c.marketingOptIn ? 'Yes' : 'No'
    }));
    if (type === 'csv') exportToCSV(data, 'ClientsDatabase');
    if (type === 'excel') exportToExcel(data, 'ClientsDatabase');
    if (type === 'json') exportToJSON(data, 'ClientsDatabase');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Check-in Database</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>JSON</Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground uppercase tracking-wider">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Phone</th>
              <th className="p-4 font-medium">Nationality</th>
              <th className="p-4 font-medium">Marketing</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                <td className="p-4 font-medium">{c.name}</td>
                <td className="p-4 text-muted-foreground">{c.email}</td>
                <td className="p-4 text-muted-foreground">{c.phone}</td>
                <td className="p-4 text-muted-foreground">{c.nationality || '-'}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.marketingOptIn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {c.marketingOptIn ? 'Yes' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">No clients found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}