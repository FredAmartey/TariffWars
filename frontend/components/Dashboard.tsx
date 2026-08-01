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
import { Modal } from "./Modal";

interface CollapsibleHeaderProps {
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  toggleOpen: () => void;
  isMobile: boolean;
}

const CollapsibleHeader: React.FC<CollapsibleHeaderProps> = ({
  title,
  icon: Icon,
  isOpen,
  toggleOpen,
  isMobile,
}) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center">
      <Icon className="h-5 w-5 mr-2 text-muted-foreground" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    </div>
    {isMobile && (
      <button
        onClick={toggleOpen}
        className="p-1 rounded-md text-muted-foreground hover:bg-accent"
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
  setActiveTab: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const { addNotification } = useNotifications();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDataset, setExportDataset] = useState<"product" | "country">("product");
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  // TariffTable owns its own search, sort and filter state. This page used to
  // declare a frozen "", "effectiveDate", "desc" and [] and pass them down,
  // which only restated the component's own defaults; the search string in
  // particular was permanently empty, so the export wiring that read it and the
  // modal copy that reported it were both unreachable. The dashboard has no
  // search box: that lives on the Tariff Rates page.
  const itemsPerPage = 5;

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

    // The modal promises "the current tariff data", so pass along which table
    // is open and what is being searched. It used to always export the
    // commodity list unfiltered, even from the Countries tab.
    const params = new URLSearchParams({ format: exportFormat, dataset: exportDataset });

    window.open(
      `${window.location.origin}/projects/tariff-wars/api/tariffs/export?${params}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* The page heading. This was an h2 while the news widget below
              supplied the document's only h1, inverting the outline. */}
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Global Tariff Insights
          </h1>
          <p className="mt-1 text-muted-foreground">
            Real-time analysis and impact assessment of international trade policies
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-muted hover:bg-accent text-gray-700 dark:text-yellow-300"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 rounded-full flex items-center bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-medium"
          >
            <DownloadIcon className="h-4 w-4 mr-2" />
            Export Data
          </button>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden bg-linear-to-r from-indigo-50 to-purple-50 border border-indigo-100 dark:from-indigo-900/40 dark:to-purple-900/40 dark:border-indigo-800/50">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <TrendingUpIcon className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">
              Key Metrics
            </h3>
          </div>
          <TariffStats />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 lg:col-span-2 rounded-xl overflow-hidden bg-card border border-border shadow-xs dark:shadow-none">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <BarChart2Icon className="h-5 w-5 mr-2 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">Current Tariff Rates</h3>
              </div>
            </div>
            {/* Compact drops "Tariff from" (USA on all but a handful of rows)
                and "Type". The full eight-column layout was ~60px wider than
                this card, so the effective date was clipped mid-value. */}
            <TariffTable
              page={currentPage}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onDatasetChange={setExportDataset}
              variant="compact"
            />
            <DataFreshness />
          </div>
        </div>
        <div className="rounded-xl overflow-hidden bg-linear-to-br from-blue-50 to-purple-50 border border-blue-100 dark:from-blue-900/30 dark:to-purple-900/30 dark:border-blue-800/50">
          <div className="p-6">
            <CollapsibleHeader
              title="AI Market Analysis"
              icon={TrendingUpIcon}
              isOpen={isAiAnalysisOpen}
              toggleOpen={() => setIsAiAnalysisOpen(!isAiAnalysisOpen)}
              isMobile={isMobile}
            />
            {/* The header derives this id from the title, so it must match
                "AI Market Analysis" exactly. It said "collapsible-ai-analysis",
                pointing aria-controls at an element that did not exist. */}
            <div
              id="collapsible-ai-market-analysis"
              className={`${!isAiAnalysisOpen && isMobile ? "hidden" : "block"}`}
            >
              <AIInsights showDetailedAnalysis={() => setShowMarketAnalysis(true)} />
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden bg-card border border-border shadow-xs dark:shadow-none">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <LineChartIcon className="h-5 w-5 mr-2 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Likely Affected Stocks</h3>
            </div>
            <div className="flex items-center">
              {(!isMobile || (isMobile && isStocksOpen)) && (
                // "Full Report" was a button firing window.open at a generic
                // Yahoo topic page, so it promised a report on these stocks and
                // was neither a report nor about them. It is now an honest,
                // labelled link out to tariff market coverage.
                <a
                  href="https://finance.yahoo.com/topic/tariffs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Tariff coverage on Yahoo Finance
                  <ChevronRightIcon className="h-4 w-4 ml-1" aria-hidden="true" />
                </a>
              )}
              {isMobile && (
                <button
                  onClick={() => setIsStocksOpen(!isStocksOpen)}
                  className="ml-2 p-1 rounded-md text-muted-foreground hover:bg-accent"
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
      <div className="rounded-xl overflow-hidden bg-card border border-border shadow-xs dark:shadow-none">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <NewspaperIcon className="h-5 w-5 mr-2 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Recent Tariff News</h3>
            </div>
            <div className="flex items-center">
              {(!isMobile || (isMobile && isNewsOpen)) && (
                <button
                  className="text-sm flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() => setActiveTab("news-feed")}
                >
                  View More
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </button>
              )}
              {isMobile && (
                <button
                  onClick={() => setIsNewsOpen(!isNewsOpen)}
                  className="ml-2 p-1 rounded-md text-muted-foreground hover:bg-accent"
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
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Data"
      >
        <div className="p-6">
          <h3 className="text-lg font-bold mb-4 text-foreground">Export Data</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Export the {exportDataset === "country" ? "countries" : "commodities"} table:
          </p>
          <div className="space-y-3">
            {["CSV", "JSON"].map((format) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                className="w-full p-3 flex items-center justify-between rounded-lg bg-muted hover:bg-accent text-foreground"
              >
                <span>Export as {format}</span>
                <DownloadIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowExportModal(false)}
              className="px-4 py-2 rounded-md bg-muted hover:bg-accent text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={showMarketAnalysis}
        onClose={() => setShowMarketAnalysis(false)}
        title="Detailed Market Analysis"
        widthClass="max-w-4xl"
      >
        <div className="overflow-hidden max-h-[90vh] flex flex-col">
          <div className="p-4 border-b border-border bg-muted dark:bg-muted/50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-foreground">Detailed Market Analysis</h3>
            <button
              onClick={() => setShowMarketAnalysis(false)}
              aria-label="Close market analysis"
              className="p-2 rounded-full hover:bg-accent"
            >
              <XIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <DetailedMarketAnalysis />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
