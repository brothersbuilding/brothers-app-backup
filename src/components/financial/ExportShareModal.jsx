import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Copy, Download, Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const EXPIRY_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: null, label: "Never expires" },
];

function QRCode({ url }) {
  const [qrUrl, setQrUrl] = useState(null);

  React.useEffect(() => {
    if (url) {
      const encodedUrl = encodeURIComponent(url);
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`);
    }
  }, [url]);

  if (!qrUrl) return null;
  return <img src={qrUrl} alt="QR Code" className="w-48 h-48 border rounded-lg" />;
}

export default function ExportShareModal({ open, onOpenChange }) {
  const [activeTab, setActiveTab] = useState("share");
  const [expiryDays, setExpiryDays] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [debug, setDebug] = useState(null);

  const generateReport = async () => {
    const payload = { expires_in_days: expiryDays };
    try {
      console.log('Calling generateShareableReport…');
      const res = await base44.functions.invoke("generateShareableReport", payload);
      console.log('Response received:', res);
      
      setDebug({
        function: 'generateShareableReport',
        sent: payload,
        received: res.data,
      });
      
      if (!res.data?.success) {
        const errorMsg = res.data?.error || res.data?.errorStack || "Failed to generate report";
        throw new Error(errorMsg);
      }
      return res.data;
    } catch (error) {
      const fullError = error.response?.data?.error || error.message || String(error);
      const errorDetails = error.response?.data?.errorStack || error.stack || '';
      const displayError = errorDetails ? `${fullError}\n\n${errorDetails}` : fullError;
      
      setDebug({
        function: 'generateShareableReport',
        sent: payload,
        error: displayError,
        fullResponse: error.response?.data || error,
      });
      
      console.error('generateReport error:', displayError);
      toast.error(fullError);
      setMessage({ type: "error", text: displayError });
      throw error;
    }
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const reportData = await generateReport();
      setShareUrl(reportData.share_url);
      setExpiresAt(reportData.expires_at);
      toast.success("Share link generated!");
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
      const token = reportData.token;
      const pdfPayload = { token };
      const pdfRes = await base44.functions.invoke("generateReportPDF", pdfPayload);

      setDebug({
        function: 'generateReportPDF',
        sent: pdfPayload,
        received: pdfRes.data,
      });

      if (pdfRes.data?.success && pdfRes.data.pdf) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${pdfRes.data.pdf}`;
        link.download = `Brothers-Building-Report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("PDF downloaded!");
        setDebug(null);
      } else {
        const errorMsg = pdfRes.data?.error || "Failed to generate PDF";
        throw new Error(errorMsg);
      }
    } catch (error) {
      const fullError = error.response?.data?.error || error.message || String(error);
      toast.error(fullError);
      setMessage({ type: "error", text: fullError });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) {
      toast.error("Please enter a recipient email");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const reportData = await generateReport();
      const token = reportData.token;
      const pdfPayload = { token };
      const pdfRes = await base44.functions.invoke("generateReportPDF", pdfPayload);

      if (!pdfRes.data?.success) {
        throw new Error(pdfRes.data?.error || "Failed to generate PDF");
      }

      const emailPayload = {
        recipient_email: recipientEmail,
        share_url: reportData.share_url,
        pdf_base64: pdfRes.data.pdf,
        expires_at: reportData.expires_at,
      };
      const emailRes = await base44.functions.invoke("sendReportEmail", emailPayload);

      setDebug({
        function: 'sendReportEmail',
        sent: { ...emailPayload, pdf_base64: '[base64 string]' },
        received: emailRes.data,
      });

      toast.success(`Report emailed to ${recipientEmail}!`);
      setRecipientEmail("");
      setActiveTab("share");
      setDebug(null);
    } catch (error) {
      const fullError = error.response?.data?.error || error.message || String(error);
      toast.error(fullError);
      setMessage({ type: "error", text: fullError });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setExpiresAt(null);
    setRecipientEmail("");
    setMessage(null);
    setDebug(null);
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
            {[
              { id: "share", label: "Share Link" },
              { id: "pdf", label: "Download PDF" },
              { id: "email", label: "Email Report" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Expiry Selector (visible on all tabs) */}
          <div className="space-y-2">
            <Label className="text-xs">Link Expiry</Label>
            <Select value={expiryDays === null ? "null" : String(expiryDays)} onValueChange={v => setExpiryDays(v === "null" ? null : parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map(opt => (
                  <SelectItem key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
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
            <div
              className={`flex items-start gap-2 p-3 rounded-lg text-sm whitespace-pre-wrap ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <p className="text-xs">{message.text}</p>
            </div>
          )}

          {/* Debug Panel */}
          {debug && (
            <div className="mt-4 p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono space-y-2 max-h-64 overflow-auto">
              <div className="font-bold text-slate-700">📋 DEBUG INFO</div>
              <div>
                <div className="font-semibold text-slate-600">Function Called:</div>
                <div className="text-slate-700">{debug.function}</div>
              </div>
              <div>
                <div className="font-semibold text-slate-600">Payload Sent:</div>
                <pre className="bg-white p-2 rounded border border-slate-200 overflow-auto text-xs">
                  {JSON.stringify(debug.sent, null, 2)}
                </pre>
              </div>
              <div>
                <div className="font-semibold text-slate-600">Response Received:</div>
                <pre className="bg-white p-2 rounded border border-slate-200 overflow-auto text-xs">
                  {debug.received ? JSON.stringify(debug.received, null, 2) : 'N/A'}
                </pre>
              </div>
              {debug.error && (
                <div>
                  <div className="font-semibold text-red-600">Error:</div>
                  <pre className="bg-red-50 p-2 rounded border border-red-200 text-red-700 text-xs overflow-auto">
                    {debug.error}
                  </pre>
                </div>
              )}
              {debug.fullResponse && (
                <div>
                  <div className="font-semibold text-slate-600">Full Response Object:</div>
                  <pre className="bg-white p-2 rounded border border-slate-200 overflow-auto text-xs">
                    {JSON.stringify(debug.fullResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          </div>
          </DialogContent>
          </Dialog>
          );
          }