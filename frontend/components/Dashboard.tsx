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
  SunIcon,
  MoonIcon,
  BarChart2Icon,
  NewspaperIcon,
  ChevronDownIcon,
} from "lucide-react";
import { AffectedStocks } from "./dashboard/AffectedStocks";
import { Modal } from "./Modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";

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
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleOpen}
        className="text-muted-foreground"
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
        aria-controls={`collapsible-${title.replace(/\s+/g, "-").toLowerCase()}`}
      >
        {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </Button>
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
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="icon-lg"
            onClick={toggleTheme}
            className="rounded-full text-foreground dark:text-yellow-300"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
          <Button size="lg" onClick={() => setShowExportModal(true)} className="rounded-full">
            <DownloadIcon />
            Export Data
          </Button>
        </div>
      </div>
      {/* The gradient panels pass their own background and ring rather than
          taking Card's `bg-card` + `ring-foreground/10`, but still use Card for
          the radius, overflow and `--card-spacing` padding system, so every
          panel on the page shares one spacing scale. */}
      <Card className={`${GRADIENT_PANEL} from-indigo-50 to-purple-50 ring-indigo-200 dark:from-indigo-900/40 dark:to-purple-900/40 dark:ring-indigo-800/50`}>
        <CardContent>
          <div className="flex items-center mb-4">
            <TrendingUpIcon className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">
              Key Metrics
            </h3>
          </div>
          <TariffStats />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className={`col-span-1 lg:col-span-2 ${PANEL}`}>
          <CardContent>
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
          </CardContent>
        </Card>
        <Card className={`${GRADIENT_PANEL} bg-linear-to-br from-blue-50 to-purple-50 ring-blue-200 dark:from-blue-900/30 dark:to-purple-900/30 dark:ring-blue-800/50`}>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
      <Card className={PANEL}>
        <CardContent>
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
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsStocksOpen(!isStocksOpen)}
                  className="ml-2 text-muted-foreground"
                  aria-expanded={isStocksOpen}
                  aria-label={`${isStocksOpen ? "Collapse" : "Expand"} Likely Affected Stocks`}
                  aria-controls="collapsible-affected-stocks"
                >
                  {isStocksOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
                </Button>
              )}
            </div>
          </div>
          <div
            id="collapsible-affected-stocks"
            className={`${!isStocksOpen && isMobile ? "hidden" : "block"}`}
          >
            <AffectedStocks />
          </div>
        </CardContent>
      </Card>
      <Card className={PANEL}>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <NewspaperIcon className="h-5 w-5 mr-2 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Recent Tariff News</h3>
            </div>
            <div className="flex items-center">
              {(!isMobile || (isMobile && isNewsOpen)) && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-blue-600 dark:text-blue-400"
                  onClick={() => setActiveTab("news-feed")}
                >
                  View More
                  <ChevronRightIcon />
                </Button>
              )}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsNewsOpen(!isNewsOpen)}
                  className="ml-2 text-muted-foreground"
                  aria-expanded={isNewsOpen}
                  aria-label={`${isNewsOpen ? "Collapse" : "Expand"} Recent Tariff News`}
                  aria-controls="collapsible-tariff-news"
                >
                  {isNewsOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
                </Button>
              )}
            </div>
          </div>
          <div
            id="collapsible-tariff-news"
            className={`${!isNewsOpen && isMobile ? "hidden" : "block"}`}
          >
            <NewsFeed preview={true} />
          </div>
        </CardContent>
      </Card>
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Data"
        description={`Export the ${
          exportDataset === "country" ? "countries" : "commodities"
        } table:`}
      >
        <div className="space-y-3">
          {["CSV", "JSON"].map((format) => (
            <Button
              key={format}
              variant="outline"
              onClick={() => handleExport(format)}
              className="w-full h-auto justify-between p-3"
            >
              <span>Export as {format}</span>
              <DownloadIcon aria-hidden="true" />
            </Button>
          ))}
        </div>
        <DialogFooter showCloseButton />
      </Modal>
      <Modal
        isOpen={showMarketAnalysis}
        onClose={() => setShowMarketAnalysis(false)}
        title="Detailed Market Analysis"
        widthClass="sm:max-w-4xl"
      >
        {/* The dialog is bounded, not the page: the body scrolls inside a
            viewport-relative box so the four sections can be any length
            without the whole overlay growing past the screen. The negative
            inset lets a scrolled section run to the dialog's edges while its
            content keeps DialogContent's padding. */}
        <div className="-mx-4 max-h-[70vh] flex-1 overflow-y-auto px-4">
          <DetailedMarketAnalysis />
        </div>
      </Modal>
    </div>
  );
};

/** The standard panel surface. Card supplies the ring, radius and overflow. */
const PANEL = "[--card-spacing:--spacing(6)]";

/**
 * A panel that paints its own gradient instead of `bg-card`.
 *
 * `bg-transparent` is load-bearing rather than redundant: `bg-card` sets
 * background-COLOR and `bg-linear-to-*` sets background-IMAGE, so without it
 * Card's opaque colour stays underneath and the dark theme's translucent
 * gradient stops composite over it instead of over the page.
 */
const GRADIENT_PANEL = `${PANEL} bg-transparent bg-linear-to-r ring-1`;

export default Dashboard;
