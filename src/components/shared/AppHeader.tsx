import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { LogOut, Menu, Package2, UserRound, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `nav-link${isActive ? " nav-link-active" : ""}`;

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const { profile, user, signOut } = useAuth();
  const name = profile?.displayName || user?.email || "My profile";

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch {
      setSignOutError("Could not sign out. Check your connection and try again.");
    }
  }

  return (
    <header className="border-b border-line bg-panel/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="StockSense dashboard">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/20">
            <Package2 size={19} aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-wide">StockSense</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
          <details className="nav-menu group">
            <summary>Operations <span aria-hidden="true">⌄</span></summary>
            <div className="nav-dropdown">
              <NavLink to="/operations/receipts">Receipts</NavLink>
              <NavLink to="/operations/deliveries">Deliveries</NavLink>
              <NavLink to="/operations/transfers">Transfers</NavLink>
              <NavLink to="/operations/adjustments">Adjustments</NavLink>
            </div>
          </details>
          <NavLink to="/products" className={linkClass}>Products</NavLink>
          <NavLink to="/move-history" className={linkClass}>Move History</NavLink>
          <details className="nav-menu group">
            <summary>Settings <span aria-hidden="true">⌄</span></summary>
            <div className="nav-dropdown">
              <NavLink to="/settings/warehouses">Warehouses</NavLink>
              <NavLink to="/settings/locations">Locations</NavLink>
            </div>
          </details>
        </nav>

        <div className="relative hidden md:block">
          <details className="nav-menu group">
            <summary className="profile-control" aria-label="Profile menu"><UserRound size={17} aria-hidden="true" /></summary>
            <div className="nav-dropdown right-0 left-auto min-w-56">
              <div className="border-b border-line px-3 py-2">
                <p className="truncate text-sm font-medium text-ink">{name}</p>
                {user?.email && <p className="truncate text-xs text-muted">{user.email}</p>}
              </div>
              <NavLink to="/profile">My Profile</NavLink>
              <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-white/5 hover:text-ink" onClick={handleSignOut}>
                <LogOut size={15} aria-hidden="true" /> Log Out
              </button>
            </div>
          </details>
        </div>

        <button
          className="icon-button md:hidden"
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {signOutError && <p className="border-t border-red-400/20 bg-red-500/10 px-4 py-2 text-sm text-red-200" role="alert">{signOutError}</p>}
      {open && (
        <nav className="grid gap-1 border-t border-line px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <NavLink onClick={() => setOpen(false)} to="/dashboard" className={linkClass}>Dashboard</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/operations/receipts" className={linkClass}>Receipts</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/operations/deliveries" className={linkClass}>Deliveries</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/operations/transfers" className={linkClass}>Transfers</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/operations/adjustments" className={linkClass}>Adjustments</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/products" className={linkClass}>Products</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/stock" className={linkClass}>Stock</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/move-history" className={linkClass}>Move History</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/settings/warehouses" className={linkClass}>Warehouses</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/settings/locations" className={linkClass}>Locations</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/profile" className={linkClass}>My Profile · {name}</NavLink>
          <button onClick={() => { setOpen(false); void handleSignOut(); }} type="button" className="nav-link flex items-center gap-2 text-left"><LogOut size={15} />Log Out</button>
        </nav>
      )}
    </header>
  );
}
