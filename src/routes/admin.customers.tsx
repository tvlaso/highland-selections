import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  UserPlus,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  ChevronLeft,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import {
  createCustomer,
  listCustomers,
  updateCustomer,
  deleteCustomer,
} from "@/lib/admin.functions";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({ meta: [{ title: "Customers | Highland Remodeling" }] }),
  component: AdminCustomers,
});

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

function AdminCustomers() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createCustomerFn = useServerFn(createCustomer);
  const listCustomersFn = useServerFn(listCustomers);
  const updateCustomerFn = useServerFn(updateCustomer);
  const deleteCustomerFn = useServerFn(deleteCustomer);

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
        customers.error instanceof Error ? customers.error.message : "Could not load customers",
      );
    }
  }, [customers.error]);

  // Add customer
  const [addOpen, setAddOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPass, setCPass] = useState("");
  const addMut = useMutation({
    mutationFn: () =>
      createCustomerFn({ data: { fullName: cName, email: cEmail, password: cPass } }),
    onSuccess: () => {
      toast.success("Customer account created");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setAddOpen(false);
      setCName("");
      setCEmail("");
      setCPass("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Edit customer
  const [editing, setEditing] = useState<Customer | null>(null);
  const [eName, setEName] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eAddress, setEAddress] = useState("");
  const openEdit = (c: Customer) => {
    setEditing(c);
    setEName(c.full_name ?? "");
    setEEmail(c.email ?? "");
    setEPhone(c.phone ?? "");
    setEAddress(c.address ?? "");
  };
  const editMut = useMutation({
    mutationFn: () =>
      updateCustomerFn({
        data: {
          id: editing!.id,
          fullName: eName,
          email: eEmail,
          phone: ePhone || null,
          address: eAddress || null,
        },
      }),
    onSuccess: () => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCustomerFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const list = customers.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Contractor Admin" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/admin">
            <ChevronLeft className="h-4 w-4" /> Back to Projects
          </Link>
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6" /> Customers
          </h1>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <UserPlus className="h-4 w-4" /> Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Customer Account</DialogTitle>
              </DialogHeader>
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
                  <Input
                    value={cPass}
                    onChange={(e) => setCPass(e.target.value)}
                    placeholder="min 8 characters"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="hero"
                  disabled={addMut.isPending || !cName || !cEmail || cPass.length < 8}
                  onClick={() => addMut.mutate()}
                >
                  Create Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-6 space-y-3">
          {customers.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No customers yet. Add your first customer to get started.
            </div>
          ) : (
            list.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{c.full_name ?? "Unnamed customer"}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {c.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phone}
                      </span>
                    )}
                    {c.address && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {c.address}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete customer?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes {c.full_name ?? "this customer"}'s account. This
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMut.mutate(c.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={eName} onChange={(e) => setEName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={ePhone} onChange={(e) => setEPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={eAddress} onChange={(e) => setEAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="hero"
              disabled={editMut.isPending || !eName || !eEmail}
              onClick={() => editMut.mutate()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}