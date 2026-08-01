import { useState, useEffect } from "react";
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
        return <AlertCircleIcon className="h-4 w-4 text-red-600 dark:text-red-300" />;
      case "positive":
        return <TrendingUpIcon className="h-4 w-4 text-green-600 dark:text-green-300" />;
      case "negative":
        return <TrendingDownIcon className="h-4 w-4 text-red-600 dark:text-red-300" />;
      default:
        return null;
    }
  };

  const getStyle = (type: AIInsight["type"]) => {
    switch (type) {
      case "alert":
        return "bg-red-50 border border-red-100 dark:bg-linear-to-br dark:from-red-900/20 dark:to-red-800/10 dark:border-red-800/30";
      case "positive":
      case "negative":
        return "bg-card border border-border dark:bg-card/50";
      default:
        return "bg-card border border-border";
    }
  };

  const getIconBgStyle = (type: AIInsight["type"]) => {
    switch (type) {
      case "alert":
        return "bg-red-100 dark:bg-red-900/50";
      case "positive":
        return "bg-green-100 dark:bg-green-900/50";
      case "negative":
        return "bg-red-100 dark:bg-red-900/50";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
            <BrainIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            AI-powered insights
          </span>
        </div>
        <button
          onClick={refreshAnalysis}
          disabled={isLoading}
          aria-label={isLoading ? "Refreshing AI insights" : "Refresh AI insights"}
          className={`p-1 rounded-full bg-muted hover:bg-accent ${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={`h-4 w-4 text-muted-foreground ${isLoading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {!isLoading && error && (
        <div className="p-4 rounded-lg text-center bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
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
                    <h4 className="font-medium text-sm text-red-700 dark:text-red-300">
                      High Risk Alert
                    </h4>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{insight.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={showDetailedAnalysis}
        className="w-full py-2 rounded-md text-sm flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-600/30 dark:hover:bg-blue-600/50 dark:text-blue-300 dark:border-blue-700/50"
      >
        <span>View Detailed Market Analysis</span>
        <ExternalLinkIcon className="h-4 w-4 ml-2" />
      </button>
    </div>
  );
};
