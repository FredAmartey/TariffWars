import { useContext } from "react";
import { ThemeContext } from "../App";
import fredAmarteyLogo from "../assets/fred-logo-complete-grey.png";

/**
 * The footer held a single logo and nothing else, so the page ended without
 * saying where any of the figures came from or what they are not.
 */
export const Footer = () => {
  const { isDarkMode } = useContext(ThemeContext);
  const linkClass = `underline hover:no-underline ${
    isDarkMode ? "hover:text-gray-200" : "hover:text-gray-900"
  }`;

  return (
    <footer
      className={`px-6 py-8 ${isDarkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-4">
        <p className="text-xs max-w-2xl">
          Tariff rates are compiled from published government notices and reputable trade
          reporting, and are refreshed weekly. Market quotes are delayed and shown for context
          only. Nothing here is legal, customs or investment advice: check the underlying notice
          before acting on a rate.
        </p>
        <p className="text-xs">
          <a
            href="https://ustr.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            USTR
          </a>
          {" · "}
          <a
            href="https://www.federalregister.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Federal Register
          </a>
          {" · "}
          <a
            href="https://github.com/FredAmartey/TariffWars"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Source on GitHub
          </a>
        </p>
        <a
          href="https://fredamartey.com/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit Fred Amartey's website"
        >
          <img src={fredAmarteyLogo} alt="Fred Amartey Project" className="h-16 w-auto" />
        </a>
      </div>
    </footer>
  );
};
