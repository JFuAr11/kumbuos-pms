import { useParams } from "react-router";
import { useState } from "react";
import { useAppContext, SupplyRequest } from "../../context/AppContext";
import { exportToCSV, exportToJSON, exportToExcel } from "../../utils/export";
import { Button } from "../../components/ui/button";
import { Edit, Trash2, Download } from "lucide-react";
import { Input } from "../../components/ui/input";

export function SupplyRequests() {
  const { category } = useParams();
  const { supplyRequests, addSupplyRequest, updateSupplyRequest, deleteSupplyRequest, selectedPropertyId } = useAppContext();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  const formattedCategory = category 
    ? category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) 
    : "General";

  const currentRequests = supplyRequests.filter(s => 
    s.propertyId === selectedPropertyId && 
    s.category.toLowerCase() === formattedCategory.toLowerCase()
  );

  const handleExport = (type: 'csv' | 'json' | 'excel') => {
    const data = currentRequests.map(r => ({
      ID: r.id,
      Date: r.date,
      Description: r.description,
      Amount: r.amount
    }));
    if (type === 'csv') exportToCSV(data, `${formattedCategory}_Supplies`);
    if (type === 'json') exportToJSON(data, `${formattedCategory}_Supplies`);
    if (type === 'excel') exportToExcel(data, `${formattedCategory}_Supplies`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !desc) return;
    
    if (editingId) {
      updateSupplyRequest(editingId, {
        amount: Number(amount),
        description: desc
      });
    } else {
      addSupplyRequest({
        id: `sup-${Date.now()}`,
        propertyId: selectedPropertyId,
        category: formattedCategory,
        amount: Number(amount),
        description: desc,
        date: new Date().toISOString().split('T')[0]
      });
    }
    setAmount("");
    setDesc("");
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (r: SupplyRequest) => {
    setEditingId(r.id);
    setDesc(r.description);
    setAmount(r.amount.toString());
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if(confirm("Are you sure?")) deleteSupplyRequest(id);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{formattedCategory} Supplies</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>JSON</Button>
          <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setAmount(""); setDesc(""); }}>
            {showForm ? "Cancel" : "New Request"}
          </Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card p-6 rounded-xl border border-border shadow-sm flex gap-4 items-end animate-in fade-in slide-in-from-top-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Description</label>
            <Input 
              type="text" 
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. 10 boxes of red wine"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estimated Cost ($)</label>
            <Input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <Button type="submit" className="h-10">
            {editingId ? "Update" : "Submit"}
          </Button>
        </form>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground uppercase tracking-wider">
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Description</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentRequests.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  No requests found for {formattedCategory}.
                </td>
              </tr>
            ) : (
              currentRequests.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="p-4">{r.date}</td>
                  <td className="p-4">{r.description}</td>
                  <td className="p-4 font-medium text-destructive">-${r.amount.toFixed(2)}</td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}><Edit size={16}/></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(r.id)}><Trash2 size={16}/></Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}