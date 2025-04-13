import React, { useContext } from 'react';
import { ThemeContext } from '../../App';
export const TariffTrendChart = () => {
  const {
    isDarkMode
  } = useContext(ThemeContext);
  // This would normally use a charting library like Chart.js or Recharts
  // For simplicity, we'll create a simple chart representation
  const chartData = [{
    month: 'Jan',
    value: 12.5
  }, {
    month: 'Feb',
    value: 13.2
  }, {
    month: 'Mar',
    value: 15.8
  }, {
    month: 'Apr',
    value: 14.3
  }, {
    month: 'May',
    value: 16.4
  }, {
    month: 'Jun',
    value: 15.9
  }];
  const maxValue = Math.max(...chartData.map(d => d.value));
  return <div className="w-full">
      <div className="flex items-end h-48 mb-2 space-x-2">
        {chartData.map((data, index) => {
        const height = data.value / maxValue * 100;
        return <div key={index} className="flex-1 flex flex-col items-center">
              <div className="relative w-full flex justify-center">
                <div className={`w-full max-w-[30px] rounded-t-sm ${isDarkMode ? 'bg-indigo-600' : 'bg-indigo-500'}`} style={{
              height: `${height}%`
            }}>
                  <div className="absolute bottom-full mb-1 text-xs text-center w-full">
                    {data.value}%
                  </div>
                </div>
              </div>
            </div>;
      })}
      </div>
      <div className="flex justify-between">
        {chartData.map((data, index) => <div key={index} className="text-center text-xs text-gray-500">
            {data.month}
          </div>)}
      </div>
      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center">
          <div className={`h-3 w-3 rounded-full ${isDarkMode ? 'bg-indigo-600' : 'bg-indigo-500'} mr-2`}></div>
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Average Global Tariff Rate
          </span>
        </div>
        <button className={`text-xs ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} hover:underline`}>
          View Full Report
        </button>
      </div>
    </div>;
};