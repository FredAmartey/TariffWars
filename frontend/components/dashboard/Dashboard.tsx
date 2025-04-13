import React from "react";
import { AffectedStocks } from "./AffectedStocks";

export const Dashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Likely Affected Stocks
        </h2>
        <AffectedStocks />
      </div>
    </div>
  );
};
