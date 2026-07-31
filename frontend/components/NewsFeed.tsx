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
  NewspaperIcon,
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

/**
 * Syndicated summaries routinely end in "Read More: https://…", which renders
 * as a wrapped, unclickable URL eating three lines of the card.
 */
function cleanSummary(summary: string | undefined): string {
  if (!summary) return "";
  return summary
    .replace(/\s*(read more|continue reading|full story)\s*:?\s*https?:\/\/\S+\s*$/i, "")
    .replace(/\s*https?:\/\/\S+\s*$/i, "")
    .trim();
}

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "N/A";
  let date = parseISO(dateString);
  if (!isValid(date)) date = new Date(dateString);
  return isValid(date) ? format(date, "MMM d, yyyy") : "N/A";
};

/**
 * A thumbnail that degrades to a placeholder rather than to a hole.
 *
 * Roughly a quarter of upstream image URLs 404 or are hotlink-blocked. The
 * previous handler set `display: none` on the broken image, which left the
 * fixed-height well behind it empty, so those cards rendered ~190px of blank
 * background above the headline.
 */
const ArticleImage: React.FC<{ article: NewsArticle; isDarkMode: boolean }> = ({
  article,
  isDarkMode,
}) => {
  const [failed, setFailed] = useState(false);

  if (!article.imageUrl || failed) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${
          isDarkMode
            ? "bg-gradient-to-br from-gray-700 to-gray-800"
            : "bg-gradient-to-br from-gray-100 to-gray-200"
        }`}
        aria-hidden="true"
      >
        <NewspaperIcon className={`h-10 w-10 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
      </div>
    );
  }

  return (
    <img
      src={article.imageUrl}
      alt=""
      loading="lazy"
      // Decorative: the headline immediately below already names the article,
      // so announcing "Image for <headline>" only repeats it.
      aria-hidden="true"
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  );
};

interface ArticleCardProps {
  article: NewsArticle;
  isDarkMode: boolean;
  isBookmarked: boolean;
  onToggleBookmark: (article: NewsArticle) => void;
  onShare: (article: NewsArticle) => void;
  /** Compact drops the thumbnail; used on narrow viewports. */
  compact?: boolean;
}

/**
 * One card, one interaction model.
 *
 * Desktop and mobile used to render separate markup with different behaviour:
 * the mobile card opened the article on tap, while the desktop card carried
 * `cursor-pointer` and a hover lift but no handler and no link, so the only way
 * to open an article was a 16px icon. The headline is now a real anchor whose
 * `::after` is stretched over the whole card, which gives both a full-card hit
 * area and a genuine link (middle-click, open-in-new-tab, keyboard focus).
 * Buttons sit above it on the z axis so they stay independently clickable.
 */
const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  isDarkMode,
  isBookmarked,
  onToggleBookmark,
  onShare,
  compact = false,
}) => {
  const summary = cleanSummary(article.summary);

  return (
    <article
      className={`group relative rounded-lg flex flex-col overflow-hidden transition-shadow ${
        isDarkMode
          ? "bg-gray-800 border border-gray-700 hover:shadow-lg hover:shadow-blue-900/20"
          : "bg-gray-50 border border-gray-200 hover:shadow-md"
      } focus-within:ring-2 focus-within:ring-blue-500`}
    >
      {!compact && (
        <div className="relative w-full h-48 flex-shrink-0">
          <ArticleImage article={article} isDarkMode={isDarkMode} />
          <button
            type="button"
            onClick={() => onToggleBookmark(article)}
            className={`absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/75 ${
              isBookmarked ? "text-yellow-400" : "text-white"
            }`}
            aria-label={
              isBookmarked ? `Remove bookmark: ${article.title}` : `Bookmark: ${article.title}`
            }
            aria-pressed={isBookmarked}
          >
            <BookmarkIcon
              className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      <div className="p-4 flex flex-col flex-grow">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`text-lg font-semibold mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}
          >
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                // The stretched pseudo-element is what makes the whole card a
                // single click target without nesting interactive elements.
                className="after:absolute after:inset-0 after:content-[''] hover:underline group-hover:text-blue-400 outline-none"
              >
                {article.title}
              </a>
            ) : (
              article.title
            )}
          </h3>
          {compact && (
            <button
              type="button"
              onClick={() => onToggleBookmark(article)}
              className={`relative z-10 flex-shrink-0 p-1.5 rounded-full ${
                isBookmarked
                  ? isDarkMode
                    ? "text-yellow-400 bg-yellow-900/30"
                    : "text-yellow-600 bg-yellow-100"
                  : isDarkMode
                  ? "text-gray-400 hover:bg-gray-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              aria-label={
                isBookmarked ? `Remove bookmark: ${article.title}` : `Bookmark: ${article.title}`
              }
              aria-pressed={isBookmarked}
            >
              <BookmarkIcon
                className={`h-5 w-5 ${isBookmarked ? "fill-current" : ""}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {summary && (
          <p
            className={`mb-4 text-sm flex-grow ${isDarkMode ? "text-gray-300" : "text-gray-700"} ${
              compact ? "line-clamp-2" : ""
            }`}
          >
            {summary}
          </p>
        )}

        <div
          className={`flex justify-between items-center text-xs mt-auto ${
            isDarkMode ? "text-gray-400" : "text-gray-500"
          }`}
        >
          <span className="flex items-center min-w-0">
            <Globe className="h-3 w-3 mr-1 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{article.source.name}</span>
          </span>
          <span className="flex items-center flex-shrink-0 ml-2">
            <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
            {formatDate(article.date)}
          </span>
        </div>

        <div className="relative z-10 flex items-center space-x-2 mt-2">
          <button
            type="button"
            onClick={() => onShare(article)}
            aria-label={`Share: ${article.title}`}
            className={`p-2 rounded-full ${
              isDarkMode ? "hover:bg-gray-600 text-gray-300" : "hover:bg-gray-200 text-gray-500"
            }`}
          >
            <Share2Icon className="h-4 w-4" aria-hidden="true" />
          </button>
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open in a new tab: ${article.title}`}
              className={`p-2 rounded-full ${
                isDarkMode ? "hover:bg-gray-600 text-blue-400" : "hover:bg-gray-200 text-blue-500"
              }`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
};

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
      // An aborted share sheet rejects too; that is a user cancelling, not a
      // failure worth putting a red toast on screen.
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error sharing article:", error);
      addNotification("Failed to share article", "error");
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
        const response = await apiService.getNewsArticles({});

        if (!response || !response.data) {
          throw new Error("Invalid response format from news API");
        }

        const data: NewsArticle[] = response.data;

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
        console.error("Error fetching news:", err);
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
  // from.
  const safePage = Math.min(currentPage, Math.max(totalPages - 1, 0));
  const startIndex = safePage * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;

  const displayedNews = preview
    ? isMobile
      ? filteredNews.slice(0, articlesPerPage)
      : filteredNews.slice(startIndex, endIndex)
    : filteredNews;

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
        <span className="sr-only">Loading news</span>
      </div>
    );
  }

  if (newsError) {
    return (
      <div className="text-center text-red-500 p-4" role="alert">
        {newsError}
      </div>
    );
  }

  return (
    <div className={`news-feed ${isDarkMode ? "dark" : ""}`}>
      {/* Embedded in the dashboard the surrounding card already carries a
          "Recent Tariff News" heading and a description, so repeating the
          banner here stacked two titles on one section. */}
      {!preview && (
        <>
          <header
            className={`p-6 rounded-xl ${
              isDarkMode
                ? "bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-800/30"
                : "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100"
            }`}
          >
            <h1 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Global Tariff News
            </h1>
            <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              Stay updated with the latest international trade tariff news and developments.
            </p>
          </header>
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
          {/* Search and filtering change the list without moving focus, so the
              count has to be announced for it to be perceivable. */}
          <p className="sr-only" role="status">
            {filteredNews.length} article{filteredNews.length === 1 ? "" : "s"}
            {searchTerm ? ` matching "${searchTerm}"` : ""}
          </p>
        </>
      )}
      <div className={`p-4 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedNews.length > 0 ? (
            displayedNews.map((article) => (
              <ArticleCard
                key={article.url || article.title}
                article={article}
                isDarkMode={isDarkMode}
                isBookmarked={bookmarkedUrls.has(article.url)}
                onToggleBookmark={toggleBookmark}
                onShare={shareArticle}
                compact={isMobile}
              />
            ))
          ) : (
            <div
              className={`col-span-full p-8 text-center rounded-lg ${
                isDarkMode ? "bg-gray-800" : "bg-gray-50"
              }`}
            >
              <p
                className={`text-lg font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
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
      </div>
    </div>
  );
};
