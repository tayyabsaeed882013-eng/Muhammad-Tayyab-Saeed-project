import React, { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  Brain,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Handle window resize to detect mobile/desktop view
  useEffect(() => {
    const handleResize = () => {
      const isCurrentlyMobile = window.innerWidth < 1024;
      setIsMobile(isCurrentlyMobile);

      // Auto-close sidebar on mobile when resizing
      if (isCurrentlyMobile) {
        setSidebarOpen(false);
      } else {
        // Always show sidebar on desktop
        setSidebarOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initialize on mount

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Close sidebar when changing routes on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Patients", href: "/patients", icon: Users },
    { name: "Diagnosis", href: "/diagnosis", icon: Stethoscope },
    { name: "EEGs", href: "/eegs", icon: Brain },
    { name: "Reports", href: "/reports", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-lg border-b border-blue-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
              <div className="flex items-center ml-4 lg:ml-0">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-xl">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <div className="ml-3">
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    MedDiagnosis
                  </span>
                  <p className="text-xs text-gray-500">Secure Medical System</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  Welcome, {user?.user_metadata?.full_name || user?.email}
                </p>
                <p className="text-xs text-gray-500">Medical Professional</p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex relative">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 transform transition-transform duration-300 ease-in-out fixed lg:sticky top-16 left-0 z-30 w-64 bg-white shadow-xl lg:shadow-lg border-r border-blue-100 h-[calc(100vh-4rem)] overflow-y-auto`}
        >
          <div className="flex flex-col h-full pt-6 pb-4">
            <nav className="flex-1 px-4 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${
                      isActive
                        ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500 text-blue-700 shadow-sm"
                        : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    } group flex items-center px-4 py-3 text-sm font-medium border-l-4 rounded-r-lg transition-all duration-200`}
                    onClick={() => isMobile && setSidebarOpen(false)}
                  >
                    <item.icon
                      className={`${
                        isActive
                          ? "text-blue-500"
                          : "text-gray-400 group-hover:text-gray-500"
                      } mr-3 h-5 w-5 transition-colors`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* System Info */}
            <div className="px-4 py-4 border-t border-gray-200 mt-auto">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3">
                <div className="flex items-center">
                  <Shield className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-xs font-medium text-blue-900">
                      Secure Session
                    </p>
                    <p className="text-xs text-blue-600">Supabase Protected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && isMobile && (
          <div
            className="lg:hidden fixed inset-0 z-20 bg-black bg-opacity-50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 lg:ml-0 min-h-[calc(100vh-4rem)]">
          <main className="py-8 px-4 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
