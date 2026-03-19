import { Outlet, NavLink, useLocation } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()
  const isDetail = location.pathname.startsWith('/transfers/')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 shadow-sm flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2.5 8h11M8 2.5l5.5 5.5-5.5 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <NavLink to="/" className="text-lg font-bold tracking-tight text-slate-900">
              Transfer<span className="text-blue-600">IQ</span>
            </NavLink>
            <span className="text-[10px] font-mono text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md ml-1 font-semibold">
              BETA
            </span>
          </div>

          <nav className="flex items-center gap-6 text-sm font-medium">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive && !isDetail
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-900 transition-colors'
              }
              end
            >
              Dashboard
            </NavLink>
            <a
              href={`${window.location.protocol}//${window.location.hostname}:8000/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-900 transition-colors"
            >
              API Docs
            </a>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-500 font-mono">
            TransferIQ v0.1 · Product of Shivam Dixit & Bhaumik Vyas
          </span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
            For demonstration purposes only
          </span>
        </div>
      </footer>
    </div>
  )
}
