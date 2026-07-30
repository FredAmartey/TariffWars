import React, { useState, useContext, useEffect } from "react";
import { ThemeContext } from "../App";
import { format, parseISO, isValid } from "date-fns";
import {
  Calendar,
  Globe,
  ExternalLink,
  BookmarkIcon,
  Share2Icon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useNotifications } from "../context/NotificationsContext";
import { NewsArticle } from "../types/index";
import { apiService } from "../services/api";

interface NewsFeedProps {
  preview?: boolean;
}

const BOOKMARK_KEY = "tariffNewsBookmarks";

/**
 * Bookmarks are rendered as click targets, and storage predates the scheme
 * check the backend now applies at ingestion. A `javascript:` or `data:` URL
 * saved by an older build would otherwise be handed straight back to the user
 * as something to activate.
 */
function isSafeUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || !raw.trim()) return false;
  try {
    const { protocol } = new URL(raw);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Never throws: bad JSON, a non-array value or blocked storage yields [].
 *
 * Earlier releases stored bare URL strings. Those are migrated rather than
 * dropped: discarding them here would combine with the persistence effect below
 * to erase every existing bookmark the first time a user loaded the new build.
 * A migrated entry keeps the link working immediately, and is upgraded to the
 * full article as soon as it appears in a live feed.
 */
function readBookmarks(): NewsArticle[] {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry): NewsArticle | null => {
        // Both shapes are checked: a legacy string and a stored object can each
        // carry a URL written before the scheme was validated anywhere.
        if (typeof entry === "string") {
          return isSafeUrl(entry)
            ? ({
                id: entry,
                title: entry,
                summary: "",
                url: entry,
                date: "",
                source: { name: "Saved link" },
              } as NewsArticle)
            : null;
        }
        if (entry && typeof entry === "object" && isSafeUrl(entry.url)) {
          return entry as NewsArticle;
        }
        return null;
      })
      .filter((a): a is NewsArticle => a !== null);
  } catch {
    return [];
  }
}

export const NewsFeed: React.FC<NewsFeedProps> = ({ preview = false }) => {
  const { isDarkMode } = useContext(ThemeContext);
  const { addNotification } = useNotifications();
  // Whole articles, not just URLs. Storing URLs alone meant a bookmark became
  // unreachable as soon as the article rotated out of the live feed. Reading is
  // guarded: malformed or non-array JSON, or storage blocked by the browser,
  // used to throw during initialisation and take the whole news view down with
  // an error boundary whose "Try again" hit the same failure every time.
  const [bookmarkedArticles, setBookmarkedArticles] = useState<NewsArticle[]>(() =>
    readBookmarks()
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "bookmarked">("all");
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const bookmarkedUrls = new Set(bookmarkedArticles.map((a) => a.url));

  const toggleBookmark = (article: NewsArticle) => {
    if (!article.url) {
      addNotification("Cannot bookmark article without a valid URL", "error");
      return;
    }
    if (bookmarkedUrls.has(article.url)) {
      setBookmarkedArticles(bookmarkedArticles.filter((a) => a.url !== article.url));
      addNotification("Article removed from bookmarks", "info");
    } else {
      setBookmarkedArticles([...bookmarkedArticles, article]);
      addNotification("Article bookmarked", "success");
    }
  };

  const shareArticle = async (article: NewsArticle) => {
    if (!article.url) {
      console.warn("Attempted to share article with undefined URL");
      addNotification("Cannot share article without a valid URL", "error");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url: article.url,
        });
      } else {
        await navigator.clipboard.writeText(article.url);
        addNotification("Link copied to clipboard", "success");
      }
    } catch (error) {
      console.error("Error sharing article:", error);
      addNotification("Failed to share article", "error");
    }
  };

  const openArticle = (url: string | undefined) => {
    console.log("openArticle called with URL:", url);
    if (!url) {
      console.warn("Attempted to open article with undefined/empty URL");
      addNotification("Cannot open article without a valid URL", "error");
      return;
    }

    try {
      console.log("Attempting to open window with URL:", url);
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");

      // Check if the window was successfully opened
      if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
        console.error("Failed to open new window, possibly blocked by popup blocker");
        addNotification("Failed to open article. Popup might be blocked.", "error");
      }
    } catch (error) {
      console.error("Error opening article URL:", error);
      addNotification("Failed to open article", "error");
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarkedArticles));
    } catch (e) {
      // Private mode or a full quota: bookmarks stay for the session only.
      console.warn("Could not persist bookmarks:", e);
    }
  }, [bookmarkedArticles]);

  useEffect(() => {
    const fetchNews = async () => {
      setIsLoadingNews(true);
      setNewsError(null);
      try {
        console.log("Fetching news articles...");
        const response = await apiService.getNewsArticles({});
        console.log("News API Response:", response);

        if (!response || !response.data) {
          throw new Error("Invalid response format from news API");
        }

        const data: NewsArticle[] = response.data;
        console.log("Processed news data:", data);

        if (!Array.isArray(data)) {
          throw new Error("News data is not in the expected array format");
        }

        setArticles(data);

        // Fill in migrated placeholders once the real article shows up in the
        // feed, so an upgraded bookmark stops reading as a bare URL.
        setBookmarkedArticles((prev) =>
          prev.map((b) => {
            if (b.title !== b.url) return b;
            return data.find((a) => a.url === b.url) ?? b;
          })
        );
      } catch (err: any) {
        console.error("Error fetching news via apiService:", err);
        setNewsError(`Failed to load news: ${err.message || "Please check the API connection"}`);
        setArticles([]);
      } finally {
        setIsLoadingNews(false);
      }
    };

    fetchNews();
  }, []);

  const articlesPerPage = 3;

  // Bookmarks are shown from storage, so one saved before the article left the
  // live feed is still reachable.
  const sourceNews = activeFilter === "bookmarked" ? bookmarkedArticles : articles;

  const filteredNews = sourceNews.filter((news: NewsArticle) => {
    if (!searchTerm) return true;
    const needle = searchTerm.toLowerCase();
    return (
      news.title.toLowerCase().includes(needle) ||
      (news.summary?.toLowerCase() || "").includes(needle) ||
      (news.source?.name?.toLowerCase() || "").includes(needle)
    );
  });

  const totalPages = Math.ceil(filteredNews.length / articlesPerPage);
  // Clamp rather than trust `currentPage`: if the list shrinks under the reader
  // (removing the last bookmark on a page, or a narrower search), an unclamped
  // index slices past the end and shows an empty list with no pager to escape
  // from. The pager and the bookmark filter do not currently render together,
  // so this is defensive.
  const safePage = Math.min(currentPage, Math.max(totalPages - 1, 0));
  const startIndex = safePage * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;

  const displayedNews = preview
    ? isMobile
      ? filteredNews.slice(0, articlesPerPage)
      : filteredNews.slice(startIndex, endIndex)
    : filteredNews;

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";

    try {
      let date = parseISO(dateString);

      if (!isValid(date)) {
        date = new Date(dateString);
      }

      if (!isValid(date)) {
        console.warn("Could not parse date string:", dateString);
        return "N/A";
      }

      return format(date, "MMM d, yyyy");
    } catch (error) {
      console.error("Error formatting date:", error, "for string:", dateString);
      return "N/A";
    }
  };

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  };

  if (isLoadingNews) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (newsError) {
    return <div className="text-center text-red-500 p-4">{newsError}</div>;
  }

  return (
    <div className={`news-feed ${isDarkMode ? "dark" : ""}`}>
      <header
        className={`p-6 rounded-xl ${
          isDarkMode
            ? "bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-800/30"
            : "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100"
        }`}
      >
        {/* Standalone this is the page heading; embedded in the dashboard the
            page already has an h1, and a second one there inverted the outline. */}
        {preview ? (
          <h2 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
            Global Tariff News
          </h2>
        ) : (
          <h1 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
            Global Tariff News
          </h1>
        )}
        <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Stay updated with the latest international trade tariff news and developments.
        </p>
      </header>
      {/* The search box and bookmark filter below were held in state with no
          controls to drive them, so neither could ever be used. */}
      {!preview && (
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(0);
              }}
              placeholder="Search headlines, summaries and sources"
              aria-label="Search news"
              className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500"
                  : "bg-white border-gray-300 text-gray-800 placeholder-gray-400"
              }`}
            />
          </div>
          <div className="flex gap-2" role="group" aria-label="Filter news">
            {(["all", "bookmarked"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setActiveFilter(filter);
                  setCurrentPage(0);
                }}
                aria-pressed={activeFilter === filter}
                className={`px-3 py-2 rounded-lg text-sm ${
                  activeFilter === filter
                    ? "bg-indigo-600 text-white"
                    : isDarkMode
                    ? "bg-gray-800 text-gray-300 border border-gray-700"
                    : "bg-white text-gray-700 border border-gray-300"
                }`}
              >
                {filter === "all" ? "All news" : `Bookmarked (${bookmarkedArticles.length})`}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`p-4 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
        {isLoadingNews ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedNews.length > 0 ? (
                displayedNews.map((article) => {
                  if (isMobile) {
                    return (
                      <article
                        key={`mobile-${article.url || article.title}`}
                        onClick={() => {
                          console.log("[Mobile Card Click] Trying to open:", article.url);
                          openArticle(article.url);
                        }}
                        className={`article-card rounded-lg overflow-hidden transition-shadow duration-300 cursor-pointer ${
                          isDarkMode
                            ? "bg-gray-800 border border-gray-700 hover:shadow-lg hover:shadow-blue-900/20"
                            : "bg-white border border-gray-200 hover:shadow-md"
                        }`}
                      >
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-2">
                              <h3
                                className={`text-base font-semibold mb-1 ${
                                  isDarkMode ? "text-blue-300" : "text-blue-600"
                                }`}
                              >
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log(
                                      "[Mobile Title Click] Trying to open:",
                                      article.url
                                    );
                                    openArticle(article.url);
                                  }}
                                  className="cursor-pointer hover:underline"
                                >
                                  {article.title}
                                </span>
                              </h3>
                              <div
                                className={`flex items-center text-xs space-x-2 ${
                                  isDarkMode ? "text-gray-400" : "text-gray-500"
                                }`}
                              >
                                <span className="flex items-center flex-shrink-0">
                                  <Globe className="h-3 w-3 mr-1" />
                                  {article.source.name}
                                </span>
                                <span className="flex items-center flex-shrink-0">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {formatDate(article.date)}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log("[Mobile Bookmark Click] URL:", article.url);
                                toggleBookmark(article);
                              }}
                              className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                                bookmarkedUrls.has(article.url)
                                  ? isDarkMode
                                    ? "text-yellow-400 bg-yellow-900/30 hover:bg-yellow-800/50"
                                    : "text-yellow-600 bg-yellow-100 hover:bg-yellow-200"
                                  : isDarkMode
                                  ? "text-gray-400 hover:bg-gray-700"
                                  : "text-gray-500 hover:bg-gray-100"
                              }`}
                              aria-label={
                                bookmarkedUrls.has(article.url)
                                  ? "Remove bookmark"
                                  : "Bookmark article"
                              }
                            >
                              <BookmarkIcon
                                className={`h-5 w-5 ${
                                  bookmarkedUrls.has(article.url)
                                    ? "fill-current"
                                    : ""
                                }`}
                              />
                            </button>
                          </div>
                          {article.summary && (
                            <p
                              className={`text-sm mb-3 ${
                                isDarkMode ? "text-gray-300" : "text-gray-600"
                              } line-clamp-2`}
                            >
                              {article.summary}
                            </p>
                          )}
                          <div className="flex items-center justify-start space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log(
                                  "[Mobile Read More Click] Trying to open:",
                                  article.url
                                );
                                openArticle(article.url);
                              }}
                              key={`read-more-${article.url || article.title}`}
                              className={`text-xs font-medium flex items-center px-3 py-1.5 rounded-md ${
                                isDarkMode
                                  ? "bg-blue-600/40 text-blue-200 hover:bg-blue-500/50 active:bg-blue-600/60"
                                  : "bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300"
                              }`}
                            >
                              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                              Read More
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log("[Mobile Share Click] URL:", article.url);
                                shareArticle(article);
                              }}
                              className={`text-xs flex items-center px-2.5 py-1 rounded-md ${
                                isDarkMode
                                  ? "bg-gray-600/30 text-gray-300 hover:bg-gray-600/50"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              <Share2Icon className="h-3.5 w-3.5 mr-1" />
                              Share
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  } else {
                    return (
                      <div
                        key={`desktop-${article.url || article.title}`}
                        className={`rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg flex flex-col overflow-hidden ${
                          isDarkMode
                            ? "bg-gray-800 hover:bg-gray-700"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div className="relative w-full h-48">
                          {article.imageUrl && (
                            <img
                              src={article.imageUrl}
                              alt={`Image for ${article.title}`}
                              className="w-full h-full object-cover"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(article);
                            }}
                            className={`absolute top-2 right-2 p-1.5 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 ${
                              bookmarkedUrls.has(article.url)
                                ? "fill-current text-yellow-400"
                                : ""
                            }`}
                            aria-label="Bookmark article"
                          >
                            <BookmarkIcon className={`h-4 w-4`} />
                          </button>
                        </div>
                        <div className="p-4 flex flex-col flex-grow">
                          <h3
                            className={`text-lg font-semibold mb-2 group-hover:text-blue-500 flex-grow ${
                              isDarkMode ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {article.title}
                          </h3>
                          <p
                            className={`mb-4 text-sm flex-grow ${
                              isDarkMode ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            {article.summary}
                          </p>
                          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-auto">
                            <span className="flex items-center">
                              <Globe className="h-3 w-3 mr-1" />
                              {article.source.name}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(article.date)}
                            </span>
                          </div>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center space-x-2 mt-2"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                shareArticle(article);
                              }}
                              aria-label={`Share: ${article.title}`}
                              className={`p-2 rounded-full ${
                                isDarkMode
                                  ? "hover:bg-gray-600 text-gray-300"
                                  : "hover:bg-gray-200 text-gray-500"
                              }`}
                            >
                              <Share2Icon className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openArticle(article.url);
                              }}
                              aria-label={`Open in a new tab: ${article.title}`}
                              className={`p-2 rounded-full ${
                                isDarkMode
                                  ? "hover:bg-gray-600 text-blue-500"
                                  : "hover:bg-gray-200 text-blue-500"
                              }`}
                            >
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })
              ) : (
                <div
                  className={`col-span-3 p-8 text-center rounded-lg ${
                    isDarkMode ? "bg-gray-800" : "bg-gray-50"
                  }`}
                >
                  <p
                    className={`text-lg font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {activeFilter === "bookmarked"
                      ? "No bookmarked articles yet."
                      : searchTerm
                      ? "No news articles match your search."
                      : "No news articles available at this time."}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    {activeFilter === "bookmarked"
                      ? "Bookmark an article to keep it here."
                      : "Please check back later for updates."}
                  </p>
                </div>
              )}
            </div>

            {preview && !isMobile && totalPages > 1 && (
              <div className="flex justify-center items-center mt-6 space-x-4">
                <button
                  onClick={handlePrevious}
                  disabled={safePage === 0}
                  aria-label="Previous page of news"
                  className={`p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDarkMode
                      ? "bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800"
                      : "bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100"
                  }`}
                >
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </button>
                <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                  Page {safePage + 1} of {totalPages}
                </span>
                <button
                  onClick={handleNext}
                  disabled={safePage >= totalPages - 1}
                  aria-label="Next page of news"
                  className={`p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDarkMode
                      ? "bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800"
                      : "bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100"
                  }`}
                >
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* A second empty state used to render directly beneath the first,
                so an empty feed showed two different messages at once. The
                one inside the grid above covers it. */}
          </>
        )}
      </div>
    </div>
  );
};
