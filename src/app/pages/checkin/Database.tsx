import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { exportToCSV, exportToExcel, exportToJSON, exportToPDF } from "../../utils/export";

export function CheckInDatabase() {
  const { checkInSubmissions, selectedPropertyId } = useAppContext();
  const [signaturePreview, setSignaturePreview] = useState<{ name: string; url: string } | null>(null);
  const submissions = checkInSubmissions
    .filter(submission => !selectedPropertyId || submission.propertyId === selectedPropertyId)
    .sort((left, right) => String(right.submissionTime).localeCompare(String(left.submissionTime)));

  const exportRows = submissions.map(submission => ({
    "Full name": submission.fullName,
    "Country of nationality": submission.countryOfNationality,
    "Type of document": submission.documentType,
    "Document number": submission.documentNumber,
    "Date of birth": submission.dateOfBirth,
    "Permanent address": submission.permanentAddress,
    "Email address": submission.emailAddress,
    "**By ticking the box below, you consent to receive offers and promotions by email from KumbuKumbu Luxury Tented Camp.**": submission.marketingConsentText,
    "*You can unsubscribe at any time by contacting us at info@luxurytentedcamp.com.*": submission.unsubscribeText,
    "*Please see our Privacy Policy: www.luxurytentedcamp.com/new-privacy-policy*": submission.privacyPolicyText,
    "Marketing Consent": submission.marketingConsent ? "Yes" : "No",
    "Marketing Consent/Agree": submission.marketingConsentAgree,
    "Guest Signature": submission.guestSignatureName || "signature.png",
    "Guest Signature_URL": submission.guestSignatureUrl,
    "_id": submission.id,
    "_uuid": submission.uuid,
    "_submission_time": submission.submissionTime,
    "_validation_status": submission.validationStatus,
    "_notes": submission.notes,
    "_status": submission.status,
    "_submitted_by": submission.submittedBy,
    "__version__": submission.version,
  }));

  const handleExport = (type: "csv" | "excel" | "json" | "pdf") => {
    if (type === "csv") exportToCSV(exportRows, "CheckInSubmissions");
    if (type === "excel") exportToExcel(exportRows, "CheckInSubmissions");
    if (type === "json") exportToJSON(exportRows, "CheckInSubmissions");
    if (type === "pdf") exportToPDF(exportRows, "CheckInSubmissions", "Check-in Database");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8" data-pdf-export-root>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Check-in Database</h1>
          <p className="text-muted-foreground">Official guest check-in submissions synchronized with Firebase PMS data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>PDF</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-medium">Guest</th>
                <th className="p-4 font-medium">Document</th>
                <th className="p-4 font-medium">Date of Birth</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Marketing</th>
                <th className="p-4 font-medium">Signature</th>
                <th className="p-4 font-medium">Submitted</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(submission => (
                <tr key={submission.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-4">
                    <p className="font-medium">{submission.fullName}</p>
                    <p className="text-xs text-muted-foreground">{submission.countryOfNationality}</p>
                  </td>
                  <td className="p-4 text-muted-foreground">{submission.documentType} {submission.documentNumber}</td>
                  <td className="p-4 text-muted-foreground">{submission.dateOfBirth || "-"}</td>
                  <td className="p-4 text-muted-foreground">{submission.emailAddress}</td>
                  <td className="p-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${submission.marketingConsent ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                      {submission.marketingConsentAgree}
                    </span>
                  </td>
                  <td className="p-4">
                    {submission.guestSignatureUrl ? (
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => setSignaturePreview({ name: submission.fullName, url: submission.guestSignatureUrl })}
                      >
                        View signature
                      </button>
                    ) : "-"}
                  </td>
                  <td className="p-4 text-muted-foreground">{new Date(submission.submissionTime).toLocaleString()}</td>
                  <td className="p-4 text-muted-foreground">{submission.status}</td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">No check-in submissions found for this property.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {signaturePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Guest signature</p>
                <h2 className="text-xl font-semibold">{signaturePreview.name}</h2>
              </div>
              <div className="flex gap-2">
                <a
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium"
                  href={signaturePreview.url}
                  download={`${signaturePreview.name.replace(/\s+/g, "-").toLowerCase()}-signature.png`}
                >
                  Download PNG
                </a>
                <Button variant="outline" size="sm" onClick={() => setSignaturePreview(null)}>Close</Button>
              </div>
            </div>
            <div className="bg-white p-5">
              <img
                src={signaturePreview.url}
                alt={`${signaturePreview.name} signature`}
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
