import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths } from "date-fns";
import { Copy, Download, Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const EXPIRY_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: null, label: "Never expires" },
];

// Maps dashboard preset keys → our period option keys
const PRESET_TO_PERIOD = {
  this_month: "this_month",
  last_month: "last_month",
  q1: "q1_2026",
  q2: "q2_2026",
  q3: "q3_2026",
  q4: "q4_2026",
  ytd: "ytd",
  year_to_last_month: "year_to_last_month",
};

const PERIOD_OPTIONS = [
  { value: "this_month",        label: "This Month" },
  { value: "last_month",        label: "Last Month" },
  { value: "q1_2026",           label: "Q1 2026" },
  { value: "q2_2026",           label: "Q2 2026" },
  { value: "q3_2026",           label: "Q3 2026" },
  { value: "q4_2026",           label: "Q4 2026" },
  { value: "year_to_last_month", label: "Year to Last Month End" },
  { value: "ytd",               label: "YTD" },
  { value: "full_year_2025",    label: "Full Year 2025" },
  { value: "full_year_2024",    label: "Full Year 2024" },
];

function getPeriodInfo(periodValue) {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthDate = subMonths(now, 1);
  const lastMonthStart = startOfMonth(lastMonthDate);
  const lastMonthEnd = endOfMonth(lastMonthDate);

  const fmtDate = (d) => format(d, "MMM d, yyyy");

  switch (periodValue) {
    case "this_month":
      return {
        label: `${format(now, "MMMM yyyy")}`,
        range: `${fmtDate(thisMonthStart)} – ${fmtDate(thisMonthEnd)}`,
        preset: "this_month",
      };
    case "last_month":
      return {
        label: `${format(lastMonthDate, "MMMM yyyy")}`,
        range: `${fmtDate(lastMonthStart)} – ${fmtDate(lastMonthEnd)}`,
        preset: "last_month",
      };
    case "q1_2026":
      return { label: "Q1 2026", range: "Jan 1 – Mar 31, 2026", preset: "q1" };
    case "q2_2026":
      return { label: "Q2 2026", range: "Apr 1 – Jun 30, 2026", preset: "q2" };
    case "q3_2026":
      return { label: "Q3 2026", range: "Jul 1 – Sep 30, 2026", preset: "q3" };
    case "q4_2026":
      return { label: "Q4 2026", range: "Oct 1 – Dec 31, 2026", preset: "q4" };
    case "year_to_last_month":
      return {
        label: `January – ${format(lastMonthDate, "MMMM yyyy")}`,
        range: `Jan 1, 2026 – ${fmtDate(lastMonthEnd)}`,
        preset: "year_to_last_month",
      };
    case "ytd":
      return {
        label: `Year to Date ${now.getFullYear()}`,
        range: `Jan 1, ${now.getFullYear()} – ${fmtDate(now)}`,
        preset: "ytd",
      };
    case "full_year_2025":
      return { label: "Full Year 2025", range: "Jan 1 – Dec 31, 2025", preset: "full_year_2025" };
    case "full_year_2024":
      return { label: "Full Year 2024", range: "Jan 1 – Dec 31, 2024", preset: "full_year_2024" };
    default:
      return { label: "Year to Date 2026", range: `Jan 1, 2026 – ${fmtDate(now)}`, preset: "ytd" };
  }
}

function QRCode({ url }) {
  const [qrUrl, setQrUrl] = useState(null);
  useEffect(() => {
    if (url) {
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`);
    }
  }, [url]);
  if (!qrUrl) return null;
  return <img src={qrUrl} alt="QR Code" className="w-48 h-48 border rounded-lg" />;
}

export default function ExportShareModal({ open, onOpenChange, currentPreset = "ytd", currentRange }) {
  const [activeTab, setActiveTab] = useState("share");
  const [expiryDays, setExpiryDays] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");

  // Default selected period from dashboard preset
  const defaultPeriod = PRESET_TO_PERIOD[currentPreset] || "ytd";
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);

  // Sync when modal opens or currentPreset changes
  useEffect(() => {
    setSelectedPeriod(PRESET_TO_PERIOD[currentPreset] || "ytd");
  }, [currentPreset, open]);

  const periodInfo = useMemo(() => getPeriodInfo(selectedPeriod), [selectedPeriod]);

  const generateReport = async () => {
    const payload = {
      expires_in_days: expiryDays,
      preset: periodInfo.preset,
      period_label: periodInfo.label,
    };
    const res = await base44.functions.invoke("generateShareableReport", payload);
    if (!res.data?.success) {
      const errorMsg = res.data?.error || res.data?.errorStack || "Failed to generate report";
      throw new Error(errorMsg);
    }
    return res.data;
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const reportData = await generateReport();
      setShareUrl(reportData.share_url);
      setExpiresAt(reportData.expires_at);
      toast.success("Share link generated!");
    } catch (error) {
      const msg = error.response?.data?.error || error.message || String(error);
      toast.error(msg);
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard!");
  };

  const handleGeneratePDF = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const reportData = await generateReport();
      const pdfRes = await base44.functions.invoke("generateReportPDF", { token: reportData.token });
      if (pdfRes.data?.success && pdfRes.data.pdf) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${pdfRes.data.pdf}`;
        link.download = `Brothers-Building-Report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("PDF downloaded!");
      } else {
        throw new Error(pdfRes.data?.error || "Failed to generate PDF");
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message || String(error);
      toast.error(msg);
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) { toast.error("Please enter a recipient email"); return; }
    setLoading(true);
    setMessage(null);
    try {
      const reportData = await generateReport();
      const pdfRes = await base44.functions.invoke("generateReportPDF", { token: reportData.token });
      if (!pdfRes.data?.success) throw new Error(pdfRes.data?.error || "Failed to generate PDF");
      await base44.functions.invoke("sendReportEmail", {
        recipient_email: recipientEmail,
        share_url: reportData.share_url,
        pdf_base64: pdfRes.data.pdf,
        expires_at: reportData.expires_at,
      });
      toast.success(`Report emailed to ${recipientEmail}!`);
      setRecipientEmail("");
      setActiveTab("share");
    } catch (error) {
      const msg = error.response?.data?.error || error.message || String(error);
      toast.error(msg);
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setExpiresAt(null);
    setRecipientEmail("");
    setMessage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export & Share Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b">
            {[{ id: "share", label: "Share Link" }, { id: "pdf", label: "Download PDF" }, { id: "email", label: "Email Report" }].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Report Period Selector */}
          <div className="space-y-2">
            <Label className="text-xs">Report Period</Label>
            <Select value={selectedPeriod} onValueChange={(v) => { setSelectedPeriod(v); setShareUrl(null); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Exporting: <span className="font-medium text-foreground">{periodInfo.label}</span>
              <span className="ml-1 text-muted-foreground">({periodInfo.range})</span>
            </p>
          </div>

          {/* Link Expiry */}
          <div className="space-y-2">
            <Label className="text-xs">Link Expiry</Label>
            <Select value={expiryDays === null ? "null" : String(expiryDays)} onValueChange={v => setExpiryDays(v === "null" ? null : parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map(opt => (
                  <SelectItem key={String(opt.value)} value={String(opt.value)}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tab Content */}
          {activeTab === "share" && (
            <div className="space-y-4">
              {!shareUrl ? (
                <Button onClick={handleGenerateLink} disabled={loading} className="w-full gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Generate Link
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Share Link</Label>
                    <div className="flex gap-2">
                      <Input value={shareUrl} readOnly className="text-xs" />
                      <Button onClick={handleCopyLink} variant="outline" size="icon" title="Copy">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {expiresAt && (
                    <p className="text-xs text-muted-foreground">Expires: {expiresAt === "null" || expiresAt === null ? "Never" : expiresAt}</p>
                  )}
                  <div className="flex justify-center">
                    <QRCode url={shareUrl} />
                  </div>
                  <Button onClick={() => setShareUrl(null)} variant="outline" className="w-full">
                    Generate New Link
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "pdf" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate and download a PDF copy of the financial report.
              </p>
              <Button onClick={handleGeneratePDF} disabled={loading} className="w-full gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <Download className="w-4 h-4" />
                Generate & Download PDF
              </Button>
            </div>
          )}

          {activeTab === "email" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Recipient Email</Label>
                <Input
                  type="email"
                  placeholder="partner@example.com"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleSendEmail} disabled={loading} className="w-full gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <Mail className="w-4 h-4" />
                Send Email
              </Button>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm whitespace-pre-wrap ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              {message.type === "success"
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <p className="text-xs">{message.text}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}