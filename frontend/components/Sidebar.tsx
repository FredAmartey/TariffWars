import { useContext } from "react";
import { HomeIcon, BarChart2Icon, NewspaperIcon, XIcon } from "lucide-react";
import { ThemeContext } from "../App";
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
  const { isDarkMode } = useContext(ThemeContext);

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <aside
      className={`\
        flex flex-col transition-transform duration-300 ease-in-out z-50\
        ${isDarkMode ? "bg-gray-800" : "bg-white border-r border-gray-200"}\
        fixed inset-y-0 left-0 w-[15rem] md:w-16 lg:w-[15rem]\
        md:relative md:translate-x-0\
        ${isMobileSidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"}\
      `}
    >
      <div
        className={`px-4 py-2 border-b ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        } flex items-center lg:items-start justify-between`}
      >
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
          className={`p-1 rounded-md md:hidden flex-shrink-0 ${
            isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
          }`}
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
                      ? isDarkMode
                        ? "bg-gray-700 text-white"
                        : "bg-gray-100 text-blue-600"
                      : isDarkMode
                      ? "text-gray-400 hover:bg-gray-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
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
