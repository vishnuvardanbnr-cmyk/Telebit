import { useState } from "react";
import { Link } from "wouter";
import {
  useGetMyDematAccount,
  useUpsertMyDematAccount,
  useGetMyShareRequests,
  useSubmitShareRequest,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Leaf, CheckCircle2, Clock, PenLine, Send, ShieldCheck,
} from "lucide-react";

export default function DematPage() {
  const qc = useQueryClient();

  const { data: demat, isLoading: dematLoading } = useGetMyDematAccount();
  const { data: shareData, isLoading: shareLoading } = useGetMyShareRequests();
  const upsertDemat = useUpsertMyDematAccount();
  const submitRequest = useSubmitShareRequest();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ holderName: "", dpId: "", clientId: "" });

  function startEdit() {
    setForm({
      holderName: demat?.holderName ?? "",
      dpId: demat?.dpId ?? "",
      clientId: demat?.clientId ?? "",
    });
    setEditing(true);
  }

  async function saveDemat() {
    if (!form.holderName.trim() || !form.dpId.trim() || !form.clientId.trim()) {
      toast.error("All fields are required");
      return;
    }
    try {
      await upsertDemat.mutateAsync({ data: form });
      await qc.invalidateQueries({ queryKey: ["/users/me/demat"] });
      toast.success("Demat account saved");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    }
  }

  async function handleSubmitRequest() {
    if (!demat) {
      toast.error("Please save your demat account first");
      return;
    }
    try {
      await submitRequest.mutateAsync();
      await qc.invalidateQueries({ queryKey: ["/users/me/share-requests"] });
      toast.success("Share transfer request submitted!");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit request");
    }
  }

  const requests = shareData?.requests ?? [];
  const confirmed = shareData?.totalConfirmedShares ?? 0;
  const pending = shareData?.totalPendingShares ?? 0;

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-lg font-black tracking-tight">Demat & Share Transfers</h1>
          <p className="text-[11px] text-muted-foreground">Ethnol Bio Fuel Company shares</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-4 text-center">
          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Confirmed Shares</p>
          <p className="text-3xl font-black text-green-800 tabular-nums">{confirmed.toLocaleString()}</p>
          <p className="text-[10px] text-green-500 mt-0.5">transferred to your demat</p>
        </div>
        <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-4 text-center">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Pending</p>
          <p className="text-3xl font-black text-amber-800 tabular-nums">{pending.toLocaleString()}</p>
          <p className="text-[10px] text-amber-500 mt-0.5">awaiting admin transfer</p>
        </div>
      </div>

      {/* Demat account card */}
      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-sm font-black uppercase tracking-wider">Demat Account</span>
          </div>
          {demat && !editing && (
            <button onClick={startEdit} className="flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase tracking-wider">
              <PenLine className="w-3 h-3" /> Edit
            </button>
          )}
        </div>

        <div className="px-5 py-5">
          {dematLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : !demat || editing ? (
            <div className="space-y-4">
              {!demat && !editing && (
                <p className="text-xs text-muted-foreground">
                  Add your demat account details to receive Ethnol Bio Fuel shares directly into your demat account.
                </p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Holder Name</label>
                  <Input
                    className="mt-1 rounded-xl"
                    placeholder="As per your demat account"
                    value={form.holderName}
                    onChange={(e) => setForm((f) => ({ ...f, holderName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">DP ID</label>
                  <Input
                    className="mt-1 rounded-xl font-mono"
                    placeholder="e.g. IN301234"
                    value={form.dpId}
                    onChange={(e) => setForm((f) => ({ ...f, dpId: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Client ID</label>
                  <Input
                    className="mt-1 rounded-xl font-mono"
                    placeholder="e.g. 56789012"
                    value={form.clientId}
                    onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={saveDemat}
                  disabled={upsertDemat.isPending}
                  className="flex-1 rounded-xl bg-green-700 hover:bg-green-800 font-bold uppercase tracking-wider text-xs"
                >
                  {upsertDemat.isPending ? "Saving…" : "Save Demat Account"}
                </Button>
                {editing && (
                  <Button variant="outline" className="rounded-xl" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Holder Name</p>
                  <p className="text-sm font-bold mt-0.5">{demat.holderName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">DP ID</p>
                  <p className="text-sm font-mono font-bold mt-0.5">{demat.dpId}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client ID</p>
                  <p className="text-sm font-mono font-bold mt-0.5">{demat.clientId}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                <span className="text-[11px] text-green-700 font-semibold">Account verified and saved</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit request button */}
      {demat && !editing && (
        <Button
          onClick={handleSubmitRequest}
          disabled={submitRequest.isPending || !demat}
          className="w-full rounded-2xl h-14 bg-green-700 hover:bg-green-800 font-black text-base uppercase tracking-wider flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
          {submitRequest.isPending ? "Submitting…" : "Request Share Transfer"}
        </Button>
      )}

      {/* Request history */}
      {requests.length > 0 && (
        <div className="rounded-2xl border border-border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-600" />
            <span className="text-sm font-black uppercase tracking-wider">Transfer History</span>
          </div>
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <div key={r.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{r.sharesCount} shares</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(r.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {r.adminNote && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 italic">"{r.adminNote}"</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {r.status === "transferred" ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-black text-green-700 uppercase tracking-wider">Transferred</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Pending</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!shareLoading && requests.length === 0 && demat && (
        <div className="text-center py-8">
          <Leaf className="w-8 h-8 text-green-200 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No share transfer requests yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Tap the button above to submit your first request.</p>
        </div>
      )}
    </div>
  );
}
