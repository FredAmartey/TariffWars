import { useState, useContext, useEffect } from "react";
import { ThemeContext } from "../../App";
import {
  BrainIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { marketAnalysisApi } from "../../services/marketAnalysisApi";
import type { AIInsight } from "../../services/marketAnalysisApi";

interface AIInsightsProps {
  showDetailedAnalysis?: () => void;
}

export const AIInsights = ({ showDetailedAnalysis }: AIInsightsProps) => {
  const { isDarkMode } = useContext(ThemeContext);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);

  const fetchInsights = async (bypassCache = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await marketAnalysisApi.getAIInsights(bypassCache);
      setAiInsights(data);
    } catch (err: any) {
      console.error("Error fetching AI insights:", err);
      setError(err.message || "Failed to load insights");
      setAiInsights([
        { type: "alert", text: "Error loading insights." },
        { type: "negative", text: err.message || "Please check connection." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights(false);
  }, []);

  const refreshAnalysis = () => {
    fetchInsights(true);
  };

  const getIcon = (type: AIInsight["type"]) => {
    switch (type) {
      case "alert":
        return (
          <AlertCircleIcon className={`h-4 w-4 ${isDarkMode ? "text-red-300" : "text-red-600"}`} />
        );
      case "positive":
        return (
          <TrendingUpIcon
            className={`h-4 w-4 ${isDarkMode ? "text-green-300" : "text-green-600"}`}
          />
        );
      case "negative":
        return (
          <TrendingDownIcon className={`h-4 w-4 ${isDarkMode ? "text-red-300" : "text-red-600"}`} />
        );
      default:
        return null;
    }
  };

  const getStyle = (type: AIInsight["type"]) => {
    switch (type) {
      case "alert":
        return isDarkMode
          ? "bg-gradient-to-br from-red-900/20 to-red-800/10 border border-red-800/30"
          : "bg-red-50 border border-red-100";
      case "positive":
        return isDarkMode
          ? "bg-gray-800/50 border border-gray-700"
          : "bg-white border border-gray-200";
      case "negative":
        return isDarkMode
          ? "bg-gray-800/50 border border-gray-700"
          : "bg-white border border-gray-200";
      default:
        return isDarkMode
          ? "bg-gray-800 border border-gray-700"
          : "bg-white border border-gray-200";
    }
  };

  const getIconBgStyle = (type: AIInsight["type"]) => {
    switch (type) {
      case "alert":
        return isDarkMode ? "bg-red-900/50" : "bg-red-100";
      case "positive":
        return isDarkMode ? "bg-green-900/50" : "bg-green-100";
      case "negative":
        return isDarkMode ? "bg-red-900/50" : "bg-red-100";
      default:
        return isDarkMode ? "bg-gray-700" : "bg-gray-100";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`p-2 rounded-full ${isDarkMode ? "bg-blue-900/50" : "bg-blue-100"}`}>
            <BrainIcon className={`h-5 w-5 ${isDarkMode ? "text-blue-300" : "text-blue-600"}`} />
          </div>
          <span
            className={`ml-2 text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
          >
            AI-powered insights
          </span>
        </div>
        <button
          onClick={refreshAnalysis}
          disabled={isLoading}
          aria-label={isLoading ? "Refreshing AI insights" : "Refresh AI insights"}
          className={`p-1 rounded-full ${
            isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={`h-4 w-4 ${isDarkMode ? "text-gray-300" : "text-gray-600"} ${
              isLoading ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {!isLoading && error && (
        <div
          className={`p-4 rounded-lg text-center ${
            isDarkMode ? "bg-red-900/30 text-red-300" : "bg-red-100 text-red-700"
          }`}
        >
          Error: {error}
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          {aiInsights.map((insight, index) => (
            <div key={index} className={`p-4 rounded-lg ${getStyle(insight.type)}`}>
              <div className="flex items-start">
                <div className={`p-1.5 rounded-full ${getIconBgStyle(insight.type)} mt-0.5 mr-3`}>
                  {getIcon(insight.type)}
                </div>
                <div>
                  {insight.type === "alert" && (
                    <h4
                      className={`font-medium text-sm ${
                        isDarkMode ? "text-red-300" : "text-red-700"
                      }`}
                    >
                      High Risk Alert
                    </h4>
                  )}
                  <p className={`mt-1 text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    {insight.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={showDetailedAnalysis}
        className={`w-full py-2 rounded-md text-sm flex items-center justify-center ${
          isDarkMode
            ? "bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-700/50"
            : "bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"
        }`}
      >
        <span>View Detailed Market Analysis</span>
        <ExternalLinkIcon className="h-4 w-4 ml-2" />
      </button>
    </div>
  );
};
