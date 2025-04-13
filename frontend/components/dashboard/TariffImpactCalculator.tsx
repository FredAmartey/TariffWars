import React, { useState, useContext } from 'react';
import { ThemeContext } from '../../App';
import { useNotifications } from '../../context/NotificationsContext';
import { Calculator, RefreshCwIcon } from 'lucide-react';
export const TariffImpactCalculator = () => {
  const {
    isDarkMode
  } = useContext(ThemeContext);
  const {
    addNotification
  } = useNotifications();
  const [commodity, setCommodity] = useState('Steel');
  const [fromCountry, setFromCountry] = useState('China');
  const [toCountry, setToCountry] = useState('United States');
  const [value, setValue] = useState('10000');
  const [tariffRate, setTariffRate] = useState('25');
  const [isCalculating, setIsCalculating] = useState(false);
  const handleCalculate = () => {
    setIsCalculating(true);
    // Simulate calculation delay
    setTimeout(() => {
      setIsCalculating(false);
      addNotification('Tariff impact calculation completed', 'success');
    }, 1000);
  };
  const tariffAmount = parseFloat(value) * (parseFloat(tariffRate) / 100);
  const totalCost = parseFloat(value) + tariffAmount;
  return <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Commodity
          </label>
          <select value={commodity} onChange={e => setCommodity(e.target.value)} className={`w-full p-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
            <option>Steel</option>
            <option>Aluminum</option>
            <option>Soybeans</option>
            <option>Cotton</option>
            <option>Copper</option>
            <option>Wheat</option>
          </select>
        </div>
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Shipment Value ($)
          </label>
          <input type="number" value={value} onChange={e => setValue(e.target.value)} className={`w-full p-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Enter value" />
        </div>
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            From Country
          </label>
          <select value={fromCountry} onChange={e => setFromCountry(e.target.value)} className={`w-full p-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
            <option>China</option>
            <option>United States</option>
            <option>European Union</option>
            <option>Japan</option>
            <option>Canada</option>
            <option>Mexico</option>
          </select>
        </div>
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            To Country
          </label>
          <select value={toCountry} onChange={e => setToCountry(e.target.value)} className={`w-full p-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
            <option>United States</option>
            <option>China</option>
            <option>European Union</option>
            <option>Japan</option>
            <option>Canada</option>
            <option>Mexico</option>
          </select>
        </div>
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Tariff Rate (%)
          </label>
          <input type="number" value={tariffRate} onChange={e => setTariffRate(e.target.value)} className={`w-full p-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Enter tariff rate" />
        </div>
        <div className="flex items-end">
          <button onClick={handleCalculate} disabled={isCalculating} className={`w-full p-2 rounded-md flex items-center justify-center ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}>
            {isCalculating ? <>
                <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                Calculating...
              </> : <>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Impact
              </>}
          </button>
        </div>
      </div>
      <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
        <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Impact Summary
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Tariff Amount
            </p>
            <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ${tariffAmount.toFixed(2)}
            </p>
          </div>
          <div>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Total Cost
            </p>
            <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ${totalCost.toFixed(2)}
            </p>
          </div>
          <div>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Effective Rate
            </p>
            <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {tariffRate}%
            </p>
          </div>
          <div>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Price Increase
            </p>
            <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {tariffRate}%
            </p>
          </div>
        </div>
      </div>
    </div>;
};