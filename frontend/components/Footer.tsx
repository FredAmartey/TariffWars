import { useContext } from "react";
import { ThemeContext } from "../App";
import fredAmarteyLogo from "../assets/fred-logo-complete-grey.png";

export const Footer = () => {
  const { isDarkMode } = useContext(ThemeContext);

  return (
    <footer
      className={`p-4 flex flex-col items-center justify-center ${
        isDarkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"
      }`}
    >
      <div className="mb-4 flex items-center justify-center">
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
