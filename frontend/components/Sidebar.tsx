import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { HomeIcon, BarChart2Icon, NewspaperIcon, XIcon } from "lucide-react";
import { ThemeContext } from "../App";
import tariffWarsLogo from "../assets/tariffwars-logo.png";

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
  const navigate = useNavigate();

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
        <img
          src={tariffWarsLogo}
          alt="TariffWars Logo"
          className={`w-auto transition-all duration-200 ${
            isMobileSidebarOpen ? "h-8 opacity-100" : "md:opacity-0 md:h-8 lg:opacity-100 lg:h-56"
          }`}
        />
        <button
          onClick={toggleMobileSidebar}
          className={`p-1 rounded-md md:hidden ${
            isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
          }`}
          aria-label="Close menu"
        >
          <XIcon className="h-6 w-6" />
        </button>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => handleNavigate("dashboard")}
              className={`flex items-center justify-center md:justify-start w-full p-2 rounded-md ${
                activeTab === "dashboard"
                  ? isDarkMode
                    ? "bg-gray-700 text-white"
                    : "bg-gray-100 text-blue-600"
                  : isDarkMode
                  ? "text-gray-400 hover:bg-gray-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <HomeIcon className="h-5 w-5" />
              <span
                className={`ml-3 transition-opacity duration-200 ${
                  isMobileSidebarOpen ? "opacity-100" : "md:opacity-0 lg:opacity-100"
                }`}
              >
                Dashboard
              </span>
            </button>
          </li>
          <li>
            <button
              onClick={() => handleNavigate("tariff-rates")}
              className={`flex items-center justify-center md:justify-start w-full p-2 rounded-md ${
                activeTab === "tariff-rates"
                  ? isDarkMode
                    ? "bg-gray-700 text-white"
                    : "bg-gray-100 text-blue-600"
                  : isDarkMode
                  ? "text-gray-400 hover:bg-gray-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <BarChart2Icon className="h-5 w-5" />
              <span
                className={`ml-3 transition-opacity duration-200 ${
                  isMobileSidebarOpen ? "opacity-100" : "md:opacity-0 lg:opacity-100"
                }`}
              >
                Tariff Rates
              </span>
            </button>
          </li>
          <li>
            <button
              onClick={() => handleNavigate("news-feed")}
              className={`flex items-center justify-center md:justify-start w-full p-2 rounded-md ${
                activeTab === "news-feed"
                  ? isDarkMode
                    ? "bg-gray-700 text-white"
                    : "bg-gray-100 text-blue-600"
                  : isDarkMode
                  ? "text-gray-400 hover:bg-gray-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <NewspaperIcon className="h-5 w-5" />
              <span
                className={`ml-3 transition-opacity duration-200 ${
                  isMobileSidebarOpen ? "opacity-100" : "md:opacity-0 lg:opacity-100"
                }`}
              >
                News Feed
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
};
