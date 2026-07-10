import React, { useState, useContext, useEffect } from "react";
import { TariffStats } from "./dashboard/TariffStats";
import { TariffTable } from "./dashboard/TariffTable";
import { DataFreshness } from "./dashboard/DataFreshness";
import { NewsFeed } from "./NewsFeed";
import { AIInsights } from "./dashboard/AIInsights";
import { DetailedMarketAnalysis } from "./dashboard/DetailedMarketAnalysis";
import { ThemeContext } from "../App";
import { useNotifications } from "../context/NotificationsContext";
import {
  DownloadIcon,
  TrendingUpIcon,
  LineChartIcon,
  ChevronRightIcon,
  XIcon,
  SunIcon,
  MoonIcon,
  BarChart2Icon,
  NewspaperIcon,
  ChevronDownIcon,
} from "lucide-react";
import { AffectedStocks } from "./dashboard/AffectedStocks";

interface CollapsibleHeaderProps {
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  toggleOpen: () => void;
  isMobile: boolean;
  isDarkMode: boolean;
}

const CollapsibleHeader: React.FC<CollapsibleHeaderProps> = ({
  title,
  icon: Icon,
  isOpen,
  toggleOpen,
  isMobile,
  isDarkMode,
}) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center">
      <Icon className={`h-5 w-5 mr-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
      <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
        {title}
      </h3>
    </div>
    {isMobile && (
      <button
        onClick={toggleOpen}
        className={`p-1 rounded-md ${
          isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
        }`}
        aria-expanded={isOpen}
        aria-controls={`collapsible-${title.replace(/\s+/g, "-").toLowerCase()}`}
      >
        {isOpen ? (
          <ChevronDownIcon className="h-5 w-5" />
        ) : (
          <ChevronRightIcon className="h-5 w-5" />
        )}
      </button>
    )}
  </div>
);

interface DashboardProps {
  isDarkMode: boolean;
  setActiveTab: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ isDarkMode, setActiveTab }) => {
  const { addNotification } = useNotifications();
  const { toggleTheme } = useContext(ThemeContext);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("effectiveDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Array<{ field: string; value: string }>>([]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(!isMobile);
  const [isStocksOpen, setIsStocksOpen] = useState(!isMobile);
  const [isNewsOpen, setIsNewsOpen] = useState(!isMobile);
  useEffect(() => {
    setIsAiAnalysisOpen(!isMobile);
    setIsStocksOpen(!isMobile);
    setIsNewsOpen(!isMobile);
  }, [isMobile]);

  const handleExport = (format: string) => {
    const exportFormat = format.toLowerCase() === "csv" ? "csv" : "json";

    addNotification(`Preparing ${format.toUpperCase()} export...`, "info");
    setShowExportModal(false);

    const exportUrl = `${window.location.origin}/projects/tariff-wars/api/tariffs/export?format=${exportFormat}`;
    console.log("Triggering export download from URL:", exportUrl);

    window.open(exportUrl, "_blank");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2
            className={`text-3xl font-bold tracking-tight ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Global Tariff Insights
          </h2>
          <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            Real-time analysis and impact assessment of international trade policies
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full ${
              isDarkMode
                ? "bg-gray-700 hover:bg-gray-600 text-yellow-300"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className={`px-4 py-2 rounded-full flex items-center ${
              isDarkMode ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-500 hover:bg-indigo-600"
            } text-white font-medium`}
          >
            <DownloadIcon className="h-4 w-4 mr-2" />
            Export Data
          </button>
        </div>
      </div>
      <div
        className={`rounded-xl overflow-hidden ${
          isDarkMode
            ? "bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-800/50"
            : "bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center mb-4">
            <TrendingUpIcon
              className={`h-5 w-5 mr-2 ${isDarkMode ? "text-indigo-400" : "text-indigo-500"}`}
            />
            <h3
              className={`text-lg font-semibold ${
                isDarkMode ? "text-indigo-300" : "text-indigo-700"
              }`}
            >
              Key Metrics
            </h3>
          </div>
          <TariffStats />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div
          className={`col-span-1 lg:col-span-2 rounded-xl overflow-hidden ${
            isDarkMode
              ? "bg-gray-800/80 border border-gray-700"
              : "bg-white border border-gray-200 shadow-sm"
          }`}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <BarChart2Icon
                  className={`h-5 w-5 mr-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                />
                <h3
                  className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  Current Tariff Rates
                </h3>
              </div>
            </div>
            <TariffTable
              searchTerm={searchTerm}
              sortField={sortField}
              sortDirection={sortDirection}
              filters={filters}
              page={currentPage}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onTotalPagesChange={setTotalPages}
            />
            <DataFreshness />
          </div>
        </div>
        <div
          className={`rounded-xl overflow-hidden ${
            isDarkMode
              ? "bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/50"
              : "bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100"
          }`}
        >
          <div className="p-6">
            <CollapsibleHeader
              title="AI Market Analysis"
              icon={TrendingUpIcon}
              isOpen={isAiAnalysisOpen}
              toggleOpen={() => setIsAiAnalysisOpen(!isAiAnalysisOpen)}
              isMobile={isMobile}
              isDarkMode={isDarkMode}
            />
            <div
              id="collapsible-ai-analysis"
              className={`${!isAiAnalysisOpen && isMobile ? "hidden" : "block"}`}
            >
              <AIInsights showDetailedAnalysis={() => setShowMarketAnalysis(true)} />
            </div>
          </div>
        </div>
      </div>
      <div
        className={`rounded-xl overflow-hidden ${
          isDarkMode
            ? "bg-gray-800/80 border border-gray-700"
            : "bg-white border border-gray-200 shadow-sm"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <LineChartIcon
                className={`h-5 w-5 mr-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
              />
              <h3
                className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}
              >
                Likely Affected Stocks
              </h3>
            </div>
            <div className="flex items-center">
              {(!isMobile || (isMobile && isStocksOpen)) && (
                <button
                  className={`text-sm flex items-center ${
                    isDarkMode
                      ? "text-blue-400 hover:text-blue-300"
                      : "text-blue-600 hover:text-blue-700"
                  }`}
                  onClick={() => window.open("https://finance.yahoo.com/topic/tariffs", "_blank")}
                >
                  Full Report
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </button>
              )}
              {isMobile && (
                <button
                  onClick={() => setIsStocksOpen(!isStocksOpen)}
                  className={`ml-2 p-1 rounded-md ${
                    isDarkMode
                      ? "text-gray-400 hover:bg-gray-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  aria-expanded={isStocksOpen}
                  aria-controls="collapsible-affected-stocks"
                >
                  {isStocksOpen ? (
                    <ChevronDownIcon className="h-5 w-5" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
          </div>
          <div
            id="collapsible-affected-stocks"
            className={`${!isStocksOpen && isMobile ? "hidden" : "block"}`}
          >
            <AffectedStocks />
          </div>
        </div>
      </div>
      <div
        className={`rounded-xl overflow-hidden ${
          isDarkMode
            ? "bg-gray-800/80 border border-gray-700"
            : "bg-white border border-gray-200 shadow-sm"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <NewspaperIcon
                className={`h-5 w-5 mr-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
              />
              <h3
                className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}
              >
                Recent Tariff News
              </h3>
            </div>
            <div className="flex items-center">
              {(!isMobile || (isMobile && isNewsOpen)) && (
                <button
                  className={`text-sm flex items-center ${
                    isDarkMode
                      ? "text-blue-400 hover:text-blue-300"
                      : "text-blue-600 hover:text-blue-700"
                  }`}
                  onClick={() => setActiveTab("news-feed")}
                >
                  View More
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </button>
              )}
              {isMobile && (
                <button
                  onClick={() => setIsNewsOpen(!isNewsOpen)}
                  className={`ml-2 p-1 rounded-md ${
                    isDarkMode
                      ? "text-gray-400 hover:bg-gray-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  aria-expanded={isNewsOpen}
                  aria-controls="collapsible-tariff-news"
                >
                  {isNewsOpen ? (
                    <ChevronDownIcon className="h-5 w-5" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
          </div>
          <div
            id="collapsible-tariff-news"
            className={`${!isNewsOpen && isMobile ? "hidden" : "block"}`}
          >
            <NewsFeed preview={true} />
          </div>
        </div>
      </div>
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={`rounded-xl p-6 max-w-md w-full ${
              isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white shadow-xl"
            }`}
          >
            <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Export Data
            </h3>
            <p className={`mb-4 text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              Choose a format to export the current tariff data:
            </p>
            <div className="space-y-3">
              {["CSV", "JSON"].map((format) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className={`w-full p-3 flex items-center justify-between rounded-lg ${
                    isDarkMode
                      ? "bg-gray-700 hover:bg-gray-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                  }`}
                >
                  <span>Export as {format}</span>
                  <DownloadIcon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className={`px-4 py-2 rounded-md ${
                  isDarkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showMarketAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className={`rounded-xl overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col ${
              isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white shadow-xl"
            }`}
          >
            <div
              className={`p-4 border-b ${
                isDarkMode ? "border-gray-700 bg-gray-700/50" : "border-gray-200 bg-gray-50"
              } flex justify-between items-center`}
            >
              <h3 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                Detailed Market Analysis
              </h3>
              <button
                onClick={() => setShowMarketAnalysis(false)}
                className={`p-2 rounded-full ${
                  isDarkMode ? "hover:bg-gray-600" : "hover:bg-gray-200"
                }`}
              >
                <XIcon className={`h-5 w-5 ${isDarkMode ? "text-gray-300" : "text-gray-500"}`} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <DetailedMarketAnalysis />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
