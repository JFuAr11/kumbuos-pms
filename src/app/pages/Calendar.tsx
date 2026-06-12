import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { Button } from "../components/ui/button";
import { useAppContext } from "../context/AppContext";
import { exportToCSV, exportToExcel, exportToJSON } from "../utils/export";

const getStatusColor = (status: string) => {
  switch (status) {
    case "Confirmed":
    case "confirmed": return "bg-blue-100 border-blue-300 text-blue-800";
    case "Fully Paid": return "bg-green-100 border-green-300 text-green-800";
    case "Provisional": return "bg-orange-100 border-orange-300 text-orange-800";
    case "checked-in": return "bg-green-100 border-green-300 text-green-800";
    case "pending": return "bg-orange-100 border-orange-300 text-orange-800";
    case "blocked": return "bg-gray-200 border-gray-400 text-gray-700";
    case "Cancelled":
    case "cancelled": return "bg-red-100 border-red-300 text-red-800";
    default: return "bg-slate-100 border-slate-300 text-slate-800";
  }
};

export function Calendar() {
  const { reservations, rooms, clients, selectedPropertyId, rates, rateAdjustments, paymentPlans, invoices } = useAppContext();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedResId, setSelectedResId] = useState<string | null>(null);

  const daysInMonth = getDaysInMonth(currentDate);
  const startDay = startOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }).map((_, index) => addDays(startDay, index));

  const propertyRooms = rooms.filter(room => room.propertyId === selectedPropertyId);
  const propertyReservations = reservations.filter(reservation => reservation.propertyId === selectedPropertyId);

  const handleExport = (type: "csv" | "json" | "excel") => {
    const data = propertyReservations.map(reservation => ({
      ID: reservation.id,
      Client: clients.find(client => client.id === reservation.clientId)?.name || "Unknown",
      Room: propertyRooms.find(room => room.id === reservation.roomId)?.name || "Unknown",
      CheckIn: reservation.checkIn,
      CheckOut: reservation.checkOut,
      Price: reservation.price,
      Status: reservation.status,
    }));

    if (type === "csv") exportToCSV(data, "CalendarReservations");
    if (type === "json") exportToJSON(data, "CalendarReservations");
    if (type === "excel") exportToExcel(data, "CalendarReservations");
  };

  const selectedRes = propertyReservations.find(reservation => reservation.id === selectedResId);
  const selectedClient = selectedRes ? clients.find(client => client.id === selectedRes.clientId) : null;
  const selectedRoom = selectedRes ? rooms.find(room => room.id === selectedRes.roomId) : null;
  const selectedRate = selectedRes?.rateId ? rates.find(rate => rate.id === selectedRes.rateId) : null;
  const selectedDiscount = selectedRes?.discountId ? rateAdjustments.find(item => item.id === selectedRes.discountId) : null;
  const selectedTaxes = selectedRes?.taxIds?.map(id => rateAdjustments.find(item => item.id === id)).filter(Boolean) || [];
  const selectedPaymentPlan = selectedRes?.paymentPlanId ? paymentPlans.find(plan => plan.id === selectedRes.paymentPlanId) : null;
  const selectedInvoice = selectedRes ? invoices.find(invoice => invoice.reservationId === selectedRes.id) : null;
  const calendarGridTemplate = `12rem repeat(${daysInMonth}, minmax(0, 1fr))`;

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card z-10 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-foreground capitalize">
            {format(currentDate, "MMMM yyyy", { locale: enUS })}
          </h2>
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="px-2 py-1.5 hover:bg-muted text-muted-foreground border-r border-border">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 hover:bg-muted text-sm font-medium border-r border-border">
              Today
            </button>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="px-2 py-1.5 hover:bg-muted text-muted-foreground">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-2">
            <Download size={16} /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-2">
            <Download size={16} /> Excel
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 p-2 px-4 border-b border-border bg-card/50 text-xs shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-400"></div> Provisional</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-400"></div> Confirmed</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-400"></div> Fully Paid</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400"></div> Cancelled</div>
      </div>

      <div className="flex-1 overflow-auto bg-card relative">
        <div className="min-w-[920px] md:min-w-0 w-full">
          <div className="grid border-b border-border sticky top-0 bg-card z-20 w-full" style={{ gridTemplateColumns: calendarGridTemplate }}>
            <div className="p-3 border-r border-border font-semibold text-sm bg-muted/30 sticky left-0 z-30">
              Room
            </div>
            {days.map(day => (
              <div key={day.toString()} className={`min-w-0 flex flex-col items-center justify-center py-2 border-r border-border text-xs ${isToday(day) ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground"}`}>
                <span>{format(day, "E", { locale: enUS }).substring(0, 2)}</span>
                <span className="text-sm text-foreground mt-0.5">{format(day, "d")}</span>
              </div>
            ))}
          </div>

          <div className="w-full relative">
            {propertyRooms.map(room => (
              <div key={room.id} className="grid border-b border-border group hover:bg-muted/30 relative h-16" style={{ gridTemplateColumns: calendarGridTemplate }}>
                <div className="p-3 border-r border-border bg-card sticky left-0 z-20 group-hover:bg-muted/50 flex flex-col justify-center">
                  <div className="font-medium text-sm text-foreground">{room.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{room.type}</div>
                </div>

                {days.map(day => (
                  <div key={day.toString()} className={`min-w-0 border-r border-border h-full ${isToday(day) ? "bg-primary/5" : ""}`} />
                ))}

                <div className="absolute inset-y-0 left-48 right-0">
                  {propertyReservations.filter(reservation => reservation.roomId === room.id).map(reservation => {
                    const checkInDate = parseISO(reservation.checkIn);
                    const checkOutDate = parseISO(reservation.checkOut);

                    if (checkInDate.getMonth() !== currentDate.getMonth() && checkOutDate.getMonth() !== currentDate.getMonth()) {
                      if (!(checkInDate < startOfMonth(currentDate) && checkOutDate > currentDate)) return null;
                    }

                    const startOfMonthDate = startOfMonth(currentDate);
                    const startDayIndex = checkInDate >= startOfMonthDate ? checkInDate.getDate() - 1 : 0;
                    const endDayIndex = checkOutDate.getMonth() === currentDate.getMonth()
                      ? checkOutDate.getDate() - 1
                      : daysInMonth;
                    const durationDays = endDayIndex - startDayIndex;

                    if (durationDays <= 0) return null;

                    const client = clients.find(item => item.id === reservation.clientId);

                    return (
                      <div
                        key={reservation.id}
                        className={`absolute top-2 bottom-2 rounded border px-2 py-1 text-xs truncate cursor-pointer hover:shadow-md transition-shadow z-10 ${getStatusColor(reservation.status)}`}
                        style={{
                          left: `${(startDayIndex / daysInMonth) * 100}%`,
                          width: `${(durationDays / daysInMonth) * 100}%`,
                        }}
                        onClick={() => setSelectedResId(reservation.id)}
                      >
                        <div className="font-semibold">{client?.name || "Unknown"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedRes && (
        <div className="absolute top-0 right-0 bottom-0 w-full max-w-md bg-card border-l border-border shadow-2xl p-6 z-40 flex flex-col animate-in slide-in-from-right overflow-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">Reservation Details</h3>
            <button onClick={() => setSelectedResId(null)} className="text-muted-foreground hover:text-foreground">X</button>
          </div>

          <div className="space-y-4 flex-1">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Reservation</p>
              <p className="font-medium text-foreground">{selectedRes.id}</p>
              <p className="text-xs text-muted-foreground">{selectedClient?.name} · {selectedClient?.category || "Direct Client"}</p>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Check-in</p>
                <p className="font-medium text-foreground">{selectedRes.checkIn}</p>
              </div>
              <div className="flex-1 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Check-out</p>
                <p className="font-medium text-foreground">{selectedRes.checkOut}</p>
              </div>
            </div>

            <div className="p-3 border border-border rounded-md">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Status</span>
                <span className={`text-xs uppercase px-2 py-0.5 rounded-full font-bold ${getStatusColor(selectedRes.status)}`}>
                  {selectedRes.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Price</span>
                <span className="text-sm">${selectedRes.price}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Room" value={`${selectedRoom?.name || "Unknown"}${selectedRoom?.type ? ` · ${selectedRoom.type}` : ""}`} />
              <Detail label="Guests" value={`${selectedRes.guests || 1}`} />
              <Detail label="Residency" value={selectedRes.residency || "Non Resident"} />
              <Detail label="Source" value={selectedRes.source || "Direct"} />
              <Detail label="Rate" value={selectedRate ? `${selectedRate.name} · $${selectedRate.amount}` : "Not selected"} />
              <Detail label="Nights" value={`${differenceInCalendarDays(parseISO(selectedRes.checkOut), parseISO(selectedRes.checkIn))}`} />
            </div>

            <div className="p-3 border border-border rounded-md space-y-2">
              <DetailLine label="Discount" value={selectedDiscount ? selectedDiscount.name : "None"} />
              <DetailLine label="Taxes" value={selectedTaxes.length ? selectedTaxes.map(item => item?.name).join(", ") : "None"} />
              <DetailLine label="Payment Plan" value={selectedPaymentPlan?.name || "None"} />
              <DetailLine label="Invoice" value={selectedInvoice?.id || selectedRes.invoiceId || "Pending"} />
            </div>

            <div className="p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Important Notes</p>
              <p className="whitespace-pre-line text-sm text-foreground">{selectedRes.importantNotes || "No important notes recorded for this reservation."}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-muted rounded-md">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-right text-muted-foreground">{value}</span>
    </div>
  );
}
