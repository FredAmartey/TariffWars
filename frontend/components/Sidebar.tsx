import { HomeIcon, BarChart2Icon, NewspaperIcon, XIcon } from "lucide-react";
import tariffWarsLogo from "../assets/tariffwars-logo.png";

const NAV_ITEMS = [
  { tab: "dashboard", label: "Dashboard", icon: HomeIcon },
  { tab: "tariff-rates", label: "Tariff Rates", icon: BarChart2Icon },
  { tab: "news-feed", label: "News Feed", icon: NewspaperIcon },
] as const;

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
}

export const Sidebar = ({
  activeTab,
  setActiveTab,
  isMobileSidebarOpen,
  toggleMobileSidebar,
}: SidebarProps) => {
  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <aside
      className={`\
        flex flex-col transition-transform duration-300 ease-in-out z-50\
        bg-card border-r border-border\
        fixed inset-y-0 left-0 w-60 md:w-16 lg:w-60\
        md:relative md:translate-x-0\
        ${isMobileSidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"}\
      `}
    >
      <div className="px-4 py-2 border-b border-border flex items-center lg:items-start justify-between">
        {/* `h-8` is the base, not a variant. Every height used to live behind a
            `md:`/`lg:` prefix, so below `md` with the drawer closed the logo fell
            back to its intrinsic 208px width, filled the 240px panel's content
            box and pushed the close button 16px past the panel edge: a sliver of
            it sat on top of the page at the left of every mobile screen. */}
        <img
          src={tariffWarsLogo}
          alt="TariffWars Logo"
          className={`w-auto h-8 max-w-full transition-all duration-200 ${
            isMobileSidebarOpen ? "opacity-100" : "md:opacity-0 lg:opacity-100 lg:h-56"
          }`}
        />
        <button
          onClick={toggleMobileSidebar}
          className="p-1 rounded-md md:hidden shrink-0 text-muted-foreground hover:bg-accent"
          aria-label="Close menu"
        >
          <XIcon className="h-6 w-6" />
        </button>
      </div>
      <nav className="flex-1 p-4" aria-label="Main">
        <ul className="space-y-2">
          {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
            const active = activeTab === tab;
            return (
              <li key={tab}>
                <button
                  onClick={() => handleNavigate(tab)}
                  // The active tab was conveyed by background colour alone.
                  aria-current={active ? "page" : undefined}
                  title={label}
                  className={`flex items-center justify-center md:justify-start w-full p-2 rounded-md ${
                    active
                      ? "bg-accent text-blue-600 dark:text-white"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {/* Collapsed to icons at `md`, so the label is hidden with
                      opacity rather than removed: it stays the accessible name. */}
                  <span
                    className={`ml-3 transition-opacity duration-200 ${
                      isMobileSidebarOpen ? "opacity-100" : "md:opacity-0 lg:opacity-100"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};
