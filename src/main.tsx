import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Analytics } from '@vercel/analytics/react'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setQueryClient } from './lib/queryClient'
import './index.css'

// Configure TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Set global reference for use in non-React contexts (like Zustand store)
setQueryClient(queryClient)

const enableAnalytics =
  import.meta.env.PROD &&
  import.meta.env.VITE_ENABLE_ANALYTICS === 'true' &&
  window.location.hostname === 'managedle.vercel.app';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      {enableAnalytics && <Analytics />}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </React.StrictMode>,
)
