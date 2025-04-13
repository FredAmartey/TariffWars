# Tariff Wars 🌍

A comprehensive web application providing real-time analysis and impact assessment of international trade policies and tariffs. Built with modern web technologies.

## 🚀 Features

- **Real-time Tariff Analysis**: Track & analyze current and proposed tariffs across different countries and industries
- **Market Impact Assessment**: Visualize the potential impact of tariffs on specific markets and sectors
- **News Integration**: Stay updated with the latest trade policy news and developments
- **AI-powered Insights**: Get insights and recommendations based on tariff data and news
- **Export Capabilities**: Download tariff data in various formats for further analysis
- **Custom Alerts (Coming Soon)**: Set up notifications for tariff changes affecting your interests

## 🏗️ Project Structure

The project follows a modern full-stack architecture with clear separation between frontend and backend:

```
.
├── backend/              # Node.js/Express backend
│   ├── src/              # Backend source code
│   │   ├── services/     # Business logic and API integrations
│   │   ├── routes/       # API endpoints
│   │   ├── types/        # TypeScript type definitions
│   │   └── data/         # Data files and processing
│   ├── .env              # Backend environment variables
│   ├── package.json      # Backend dependencies
│   └── tsconfig.json     # TypeScript configuration
├── frontend/                  # React frontend
│   ├── components/       # Reusable UI components
│   ├── services/         # API service integrations
│   ├── context/          # React context providers
│   ├── types/            # TypeScript type definitions
│   ├── assets/           # Static assets
│   ├── App.tsx           # Main application component
│   └── index.tsx         # Entry point
├── .env                  # Frontend environment variables
├── .gitignore           # Git ignore rules
├── package.json         # Frontend dependencies
├── tsconfig.json        # TypeScript configuration
├── vercel.json          # Vercel deployment config
└── vite.config.ts       # Vite configuration
```

## 🛠️ Tech Stack

### Frontend

- **React**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **Axios**: HTTP client
- **Lucide Icons**: Icon library

### Backend

- **Node.js**: Runtime environment
- **Express**: Web framework
- **TypeScript**: Type safety
- **Axios**: HTTP client
- **Cheerio**: Web scraping
- **node-cron**: Task scheduling
- **OpenAI**: AI-powered insights

## 📋 Prerequisites

- Node.js (v18 or later)
- npm (v9 or later)
- Git

## 🚀 Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/FredAmartey-Northeastern/TariffWars.git
   cd TariffWars
   ```

2. **Install dependencies**

   ```bash
   # Install frontend dependencies
   npm install

   # Install backend dependencies
   cd backend
   npm install
   cd ..
   ```

3. **Set up environment variables**

   ```bash
   # Frontend (.env)
   cp .env.example .env

   # Backend (.env)
   cd backend
   cp .env.example .env
   cd ..
   ```

4. **Configure environment variables**

   - Frontend (.env):
     ```
     VITE_API_URL=http://localhost:3001
     VITE_FINNHUB_API_KEY=your_finnhub_api_key_here
     NODE_ENV=development
     ```
   - Backend (.env):
     ```
     PORT=3001
     NEWS_API_KEY=your_news_api_key
     OPENAI_API_KEY=your_openai_api_key
     SCRAPINGDOG_API_KEY=your_scrapingdog_api_key
     NODE_ENV=development
     ```

5. **Start the development servers**

   ```bash
   # Start backend server
   cd backend
   npm run dev

   # In a new terminal, start frontend server
   npm run dev
   ```

## 🧪 Testing

```bash
# Run frontend tests
npm test

# Run backend tests
cd backend
npm test
```

## 🏗️ Building for Production

```bash
# Build frontend
npm run build

# Build backend
cd backend
npm run build
```

## 📦 Deployment

The application is configured for deployment on Vercel. The `vercel.json` file contains the necessary configuration for both frontend and backend deployment.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Fred Amartey
