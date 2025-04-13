import React, { useEffect, useState, createContext } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Sidebar } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import { TariffRates } from "./components/TariffRates";
import { NewsFeed } from "./components/NewsFeed";
import { NotificationsProvider } from "./context/NotificationsContext";
import { Notifications } from "./components/Notifications";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Footer } from "./components/Footer";
import { MenuIcon, XIcon } from "lucide-react";

export const ThemeContext = createContext({
  isDarkMode: true,
  toggleTheme: () => {},
});

const getTabFromPathname = (pathname: string): string => {
  if (pathname.startsWith("/tariff-rates")) {
    return "tariff-rates";
  }
  if (pathname.startsWith("/news-feed")) {
    return "news-feed";
  }
  return "dashboard";
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => getTabFromPathname(location.pathname));
  const [isDarkMode, setIsDarkMode] = useState(true);
  const isAuthenticated = true;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setActiveTab(getTabFromPathname(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-scrollbar");
    } else {
      document.body.classList.remove("dark-scrollbar");
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    let path = "/dashboard";
    if (tab === "tariff-rates") {
      path = "/tariff-rates";
    } else if (tab === "news-feed") {
      path = "/news-feed";
    }
    navigate(path);

    if (isMobileSidebarOpen) {
      toggleMobileSidebar();
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        toggleTheme,
      }}
    >
      <NotificationsProvider>
        <ErrorBoundary>
          <div
            className={`w-full min-h-screen flex flex-col overflow-x-hidden ${
              isDarkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
            }`}
          >
            <div className="flex flex-1 relative">
              <Sidebar
                activeTab={activeTab}
                setActiveTab={handleTabChange}
                isMobileSidebarOpen={isMobileSidebarOpen}
                toggleMobileSidebar={toggleMobileSidebar}
              />
              <div className="flex-1 flex flex-col min-w-0">
                <header
                  className={`md:hidden flex items-center justify-between p-4 sticky top-0 z-30 ${
                    isDarkMode
                      ? "bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50"
                      : "bg-white/80 backdrop-blur-sm border-b border-gray-200/50"
                  }`}
                >
                  <button
                    onClick={toggleMobileSidebar}
                    className={`p-2 rounded-md ${
                      isDarkMode
                        ? "text-gray-300 hover:bg-gray-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                    aria-label="Toggle menu"
                  >
                    {isMobileSidebarOpen ? (
                      <XIcon className="h-6 w-6" />
                    ) : (
                      <MenuIcon className="h-6 w-6" />
                    )}
                  </button>
                  <span
                    className={`font-bold text-lg ${isDarkMode ? "text-white" : "text-gray-800"}`}
                  >
                    TariffWars
                  </span>
                </header>
                <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden">
                  <Routes>
                    <Route
                      path="/dashboard"
                      element={
                        isAuthenticated ? (
                          <Dashboard isDarkMode={isDarkMode} setActiveTab={handleTabChange} />
                        ) : (
                          <Navigate to="/login" />
                        )
                      }
                    />
                    <Route
                      path="/tariff-rates"
                      element={isAuthenticated ? <TariffRates /> : <Navigate to="/login" />}
                    />
                    <Route
                      path="/news-feed"
                      element={isAuthenticated ? <NewsFeed /> : <Navigate to="/login" />}
                    />
                    <Route
                      path="/"
                      element={
                        isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />
                      }
                    />
                    <Route path="/login" element={<div>Login Page Placeholder</div>} />
                  </Routes>
                </main>
                <Footer />
              </div>
              {isMobileSidebarOpen && (
                <div
                  className="fixed inset-0 bg-black/50 z-40 md:hidden"
                  onClick={toggleMobileSidebar}
                  aria-hidden="true"
                ></div>
              )}
            </div>
            <Notifications />
          </div>
        </ErrorBoundary>
      </NotificationsProvider>
      <Analytics debug={true} />
      <SpeedInsights debug={true} />
    </ThemeContext.Provider>
  );
};

const App: React.FC = () => {
  const getBasename = () => {
    if (window.location.pathname.startsWith("/projects/tariff-wars")) {
      return "/projects/tariff-wars";
    }
    return "/";
  };

  return (
    <Router basename={getBasename()}>
      <AppContent />
    </Router>
  );
};

export default App;
