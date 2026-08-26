import { Link, router, usePage } from '@inertiajs/react';
import {
    LayoutDashboard, Building2, Users, Megaphone, CreditCard, FileBarChart,
    ClipboardList, Phone, FileText, TrendingUp, LogOut, X, Smartphone, Repeat,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// `client` porte le partenaire courant : un client sans réseau d'agences (UBA)
// n'a pas d'écran « Agences » à proposer.
function itemsFor(user, client) {
    const items = [{ href: route('dashboard'), label: 'Dashboard', icon: LayoutDashboard, match: 'dashboard' }];

    if (user.is_direction) {
        items.push(
            { href: route('direction.campagnes.index'), label: 'Campagnes', icon: Megaphone, match: 'direction.campagnes.*' },
            { href: route('rapports.index'), label: 'Rapports', icon: FileBarChart, match: 'rapports.*' },
            { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
        );
    }

    if (user.is_admin) {
        items.push(
            { href: route('admin.campagnes.index'), label: 'Campagnes', icon: Megaphone, match: 'admin.campagnes.*' },
            ...(client?.courant?.a_des_agences === false
                ? []
                : [{ href: route('admin.agences.index'), label: 'Agences', icon: Building2, match: 'admin.agences.*' }]),
            { href: route('admin.users.index'), label: 'Utilisateurs', icon: Users, match: 'admin.users.*' },
            { href: route('admin.types-cartes.index'), label: 'Types de cartes', icon: CreditCard, match: 'admin.types-cartes.*' },
            { href: route('rapports.index'), label: 'Rapports', icon: FileBarChart, match: 'rapports.*' },
            { href: route('clients.index'), label: 'Clients', icon: Users, match: 'clients.*' },
            { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
            { href: route('admin.login-logs.index'), label: 'Journal des connexions', icon: ClipboardList, match: 'admin.login-logs.*' },
            { href: route('admin.telephonique-rapports.index'), label: 'Reporting téléphonique', icon: Phone, match: 'admin.telephonique-rapports.*' },
        );
    }

    if (user.is_commercial) {
        if (user.peut_vendre) {
            items.push({ href: route('ventes.index'), label: 'Mes ventes', icon: CreditCard, match: 'ventes.*' });
        }
        if (user.peut_enroler) {
            items.push({ href: route('enrolements.index'), label: 'Enrôlement clients', icon: Smartphone, match: 'enrolements.*' });
        }
        items.push(
            { href: route('commercial.contrat'), label: 'Mon contrat', icon: FileText, match: 'commercial.contrat' },
            { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
        );
    }

    if (user.is_commercial_telephonique) {
        items.push(
            { href: route('commercial.telephonique.create'), label: 'Reporting téléphonique', icon: Phone, match: 'commercial.telephonique.*' },
            { href: route('commercial.contrat'), label: 'Mon contrat', icon: FileText, match: 'commercial.contrat' },
            { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
        );
    }

    return items;
}

function RailItem({ item }) {
    const active = route().current(item.match);
    const Icon = item.icon;

    return (
        <Link
            href={item.href}
            className={cn(
                'group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                active ? 'bg-orange-50 text-gda-orange' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
            )}
        >
            {active && <span className="absolute left-0 h-5 w-1 rounded-r-full bg-gda-orange" />}
            <Icon size={19} strokeWidth={2} />
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                {item.label}
            </span>
        </Link>
    );
}

function DrawerItem({ item, onClick }) {
    const active = route().current(item.match);
    const Icon = item.icon;

    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-orange-50 text-gda-orange' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            )}
        >
            <Icon size={18} strokeWidth={2} />
            {item.label}
        </Link>
    );
}

function Brand({ compact = false, client }) {
    // Le nom du client remplace « BDM » : l'application sert désormais
    // plusieurs banques, et l'en-tête doit dire laquelle on regarde.
    const nom = client?.courant?.nom;

    return (
        <Link href={route('dashboard')} className="flex items-center gap-2.5">
            <img
                src="/logo/gdamoney-mark.png"
                alt=""
                className={compact ? 'h-auto w-14 object-contain' : 'h-9 w-auto object-contain'}
            />
            {!compact && (
                <span className="font-brand text-sm font-semibold text-gray-900">
                    {nom ? `Campagne ${nom}` : 'Campagnes GDA'}
                </span>
            )}
        </Link>
    );
}

function ClientRail({ client }) {
    if (!client?.courant) return null;

    const changer = client.peut_changer;
    const contenu = (
        <span
            className={cn(
                'flex h-8 w-11 items-center justify-center rounded-lg text-[11px] font-bold uppercase tracking-wide',
                'bg-orange-50 text-gda-orange ring-1 ring-orange-200',
                changer && 'transition-colors hover:bg-orange-100',
            )}
        >
            {client.courant.code}
        </span>
    );

    if (!changer) {
        return <div className="mt-4 px-2" title={client.courant.nom}>{contenu}</div>;
    }

    return (
        <Link
            href={route('partenaires.choix')}
            title={`Client : ${client.courant.nom} — changer`}
            className="group relative mt-4 px-2"
        >
            {contenu}
            <span className="pointer-events-none absolute left-full top-0 ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                Client : {client.courant.nom} — changer
            </span>
        </Link>
    );
}

function ClientDrawer({ client, onClick }) {
    if (!client?.courant) return null;

    return (
        <div className="mb-3 rounded-lg bg-orange-50 px-3 py-2.5 ring-1 ring-orange-100">
            <p className="text-[11px] font-medium uppercase tracking-wide text-orange-700/70">Client</p>
            <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-gda-orange">{client.courant.nom}</p>
                {client.peut_changer && (
                    <Link
                        href={route('partenaires.choix')}
                        onClick={onClick}
                        className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100"
                    >
                        <Repeat size={13} />
                        Changer
                    </Link>
                )}
            </div>
        </div>
    );
}

function UserAvatar({ user }) {
    return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gda-orange text-xs font-semibold text-white">
            {(user.prenom || user.name || '?').charAt(0).toUpperCase()}
        </span>
    );
}

export default function Sidebar({ open, onClose }) {
    const { auth, client } = usePage().props;
    const user = auth.user;
    const items = itemsFor(user, client);

    function logout(e) {
        e.preventDefault();
        router.post(route('logout'));
    }

    return (
        <>
            {/* Rail icônes — desktop */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col items-center border-r border-gray-200 bg-white py-5 lg:flex">
                <Brand compact />
                <ClientRail client={client} />
                <nav className="mt-4 flex flex-1 flex-col items-center gap-1.5 scrollbar-thin overflow-y-auto">
                    {items.map((item) => (
                        <RailItem key={item.label + item.href} item={item} />
                    ))}
                </nav>
                <button onClick={logout} title="Déconnexion" className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
                    <LogOut size={19} />
                </button>
                <UserAvatar user={user} />
            </aside>

            {/* Tiroir — mobile */}
            {open && <div className="fixed inset-0 z-40 bg-gray-900/40 lg:hidden" onClick={onClose} />}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform lg:hidden',
                    open ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <div
                    className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4"
                    style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
                >
                    <Brand client={client} />
                    <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>
                <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 scrollbar-thin">
                    <ClientDrawer client={client} onClick={onClose} />
                    {items.map((item) => (
                        <DrawerItem key={item.label + item.href} item={item} onClick={onClose} />
                    ))}
                </nav>
                <div className="border-t border-gray-100 p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
                        <UserAvatar user={user} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">{user.prenom || user.name}</p>
                            <p className="truncate text-xs capitalize text-gray-500">{user.role?.replace('_', ' ')}</p>
                        </div>
                        <button onClick={logout} title="Déconnexion" className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
