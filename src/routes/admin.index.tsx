import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, UserPlus, FolderKanban, ChevronRight, MapPin, Library, Check, Info, Archive, Trash2, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { SignedImage } from "@/components/SignedImage";
import { createCustomer, listCustomers } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PROJECT_STATUSES, projectTypeLabel } from "@/lib/constants";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin | Highland Remodeling" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createCustomerFn = useServerFn(createCustomer);
  const listCustomersFn = useServerFn(listCustomers);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (role === "customer") navigate({ to: "/dashboard" });
  }, [session, role, loading, navigate]);

  const customers = useQuery({
    queryKey: ["customers"],
    enabled: role === "admin",
    queryFn: () => listCustomersFn(),
  });

  useEffect(() => {
    if (customers.error) {
      toast.error(
        customers.error instanceof Error
          ? customers.error.message
          : "Could not load customers",
      );
    }
  }, [customers.error]);

  const projects = useQuery({
    queryKey: ["admin-projects"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // create customer form
  const [custOpen, setCustOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPass, setCPass] = useState("");
  const customerMut = useMutation({
    mutationFn: () => createCustomerFn({ data: { fullName: cName, email: cEmail, password: cPass } }),
    onSuccess: () => {
      toast.success("Customer account created");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setCustOpen(false);
      setCName(""); setCEmail(""); setCPass("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // create project form
  const [projOpen, setProjOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pAddress, setPAddress] = useState("");
  const [pStart, setPStart] = useState("");
  const [pStatus, setPStatus] = useState<string>("Planning");
  const [pCustomer, setPCustomer] = useState<string>("");
  const projectMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").insert({
        name: pName,
        address: pAddress || null,
        start_date: pStart || null,
        status: pStatus,
        customer_id: pCustomer || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project created");
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      setProjOpen(false);
      setPName(""); setPAddress(""); setPStart(""); setPStatus("Planning"); setPCustomer("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const customerName = (id: string | null) => {
    if (!id) return "Unassigned";
    if (customers.isLoading || !customers.data) return "…";
    return customers.data.find((c) => c.id === id)?.full_name ?? "Unassigned";
  };

  const allProjects = projects.data ?? [];
  const requestProjects = allProjects.filter((p) => p.status === "New Request");
  const currentProjects = allProjects.filter(
    (p) => p.status !== "Completed" && p.status !== "New Request" && p.status !== "Archived",
  );
  const completedProjects = allProjects.filter((p) => p.status === "Completed");

  const acceptMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").update({ status: "Active" }).eq("id", id);
      if (error) throw error;
      await supabase.from("project_timeline_events").insert({
        project_id: id,
        category: "project",
        title: "Project accepted by admin",
        description: "The project request was accepted and is now active",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      toast.success("Project accepted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const requestInfoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_timeline_events").insert({
        project_id: id,
        category: "project",
        title: "Admin requested more information",
        description: "The admin requested more information from the customer",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      toast.success("Marked as needing more info");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const archiveMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("project_timeline_events").insert({
        project_id: id,
        category: "project",
        title: "Project archived",
        description: "The project request was archived",
      });
      const { error } = await supabase.from("projects").update({ status: "Archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      toast.success("Request archived");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      toast.success("Project deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw error;
      await supabase.from("project_timeline_events").insert({
        project_id: id,
        category: "project",
        title: "Project status updated",
        description: `Status changed to ${status}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const renderProject = (p: (typeof allProjects)[number]) => (
    <Link
      key={p.id}
      to="/admin/$projectId"
      params={{ projectId: p.id }}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-accent"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold">{p.name}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                {p.status}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {PROJECT_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onSelect={(e) => {
                    e.preventDefault();
                    if (s !== p.status) statusMut.mutate({ id: p.id, status: s });
                  }}
                >
                  {s === p.status && <Check className="h-4 w-4" />}
                  <span className={s === p.status ? "font-semibold" : ""}>{s}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {projectTypeLabel(p.project_type) && (
            <span>{projectTypeLabel(p.project_type)}{" · "}</span>
          )}
          {customerName(p.customer_id)}
          {p.address && (
            <span className="inline-flex items-center gap-1">
              {" · "}<MapPin className="h-3 w-3" />{p.address}
            </span>
          )}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );

  const renderRequest = (p: (typeof allProjects)[number]) => (
    <div key={p.id} className="rounded-xl border border-accent/40 bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{projectTypeLabel(p.project_type) ?? "Project Request"}</h3>
          <p className="text-sm text-muted-foreground">{customerName(p.customer_id)}</p>
        </div>
        <time className="shrink-0 text-xs text-muted-foreground">
          {new Date(p.created_at).toLocaleDateString()}
        </time>
      </div>
      {p.project_description && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{p.project_description}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {p.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.address}</span>}
        {p.intake_timeline && <span>Timeline: {p.intake_timeline}</span>}
        {p.intake_budget && <span>Budget: {p.intake_budget}</span>}
        {p.intake_contact_method && <span>Contact: {p.intake_contact_method}</span>}
      </div>
      {p.intake_notes && <p className="mt-1 text-xs text-muted-foreground">Notes: {p.intake_notes}</p>}
      {Array.isArray(p.intake_photos) && p.intake_photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {p.intake_photos.map((path: string) => (
            <SignedImage key={path} path={path} alt="inspiration" className="h-16 w-16 rounded-lg object-cover" />
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="hero" disabled={acceptMut.isPending} onClick={() => acceptMut.mutate(p.id)}>
          <Check className="h-4 w-4" /> Accept Project
        </Button>
        <Button size="sm" variant="outline" disabled={requestInfoMut.isPending} onClick={() => requestInfoMut.mutate(p.id)}>
          <Info className="h-4 w-4" /> Request More Info
        </Button>
        <Button size="sm" variant="outline" disabled={archiveMut.isPending} onClick={() => archiveMut.mutate(p.id)}>
          <Archive className="h-4 w-4" /> Archive
        </Button>
        <Button size="sm" variant="ghost" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(p.id)}>
          <Trash2 className="h-4 w-4 text-destructive" /> Delete
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/admin/$projectId" params={{ projectId: p.id }}>
            View <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Contractor Admin" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Projects</h1>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/catalog"><Library className="h-4 w-4" /> Master Catalog</Link>
            </Button>
            <Dialog open={custOpen} onOpenChange={setCustOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><UserPlus className="h-4 w-4" /> Add Customer</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Customer Account</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Full name</Label>
                    <Input value={cName} onChange={(e) => setCName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Temporary password</Label>
                    <Input value={cPass} onChange={(e) => setCPass(e.target.value)} placeholder="min 8 characters" />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="hero"
                    disabled={customerMut.isPending || !cName || !cEmail || cPass.length < 8}
                    onClick={() => customerMut.mutate()}
                  >
                    Create Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={projOpen} onOpenChange={setProjOpen}>
              <DialogTrigger asChild>
                <Button variant="hero"><Plus className="h-4 w-4" /> New Project</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Project name</Label>
                    <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Smith Master Bath" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address</Label>
                    <Input value={pAddress} onChange={(e) => setPAddress(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Start date</Label>
                      <Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={pStatus} onValueChange={setPStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assign customer</Label>
                    <Select value={pCustomer} onValueChange={setPCustomer}>
                      <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                      <SelectContent>
                        {(customers.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name} — {c.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(customers.data ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">Add a customer first to assign one.</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="hero" disabled={projectMut.isPending || !pName} onClick={() => projectMut.mutate()}>
                    Create Project
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mt-6">
          {projects.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              {requestProjects.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                    <Inbox className="h-5 w-5 text-accent" /> New Project Requests ({requestProjects.length})
                  </h2>
                  <div className="space-y-3">{requestProjects.map(renderRequest)}</div>
                </section>
              )}
              {allProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 font-medium">No projects yet</p>
              <p className="text-sm text-muted-foreground">Create a customer, then a project to get started.</p>
            </div>
              ) : (
            <Tabs defaultValue="current">
              <TabsList>
                <TabsTrigger value="current">Current Projects ({currentProjects.length})</TabsTrigger>
                <TabsTrigger value="completed">Completed Projects ({completedProjects.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="current" className="mt-4 space-y-3">
                {currentProjects.length === 0 ? (
                  <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
                    No current projects.
                  </p>
                ) : (
                  currentProjects.map(renderProject)
                )}
              </TabsContent>
              <TabsContent value="completed" className="mt-4 space-y-3">
                {completedProjects.length === 0 ? (
                  <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
                    No completed projects.
                  </p>
                ) : (
                  completedProjects.map(renderProject)
                )}
              </TabsContent>
            </Tabs>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}