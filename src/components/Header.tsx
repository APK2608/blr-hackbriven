/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Shield, Bell, Settings, Lock, Activity, RefreshCw, Check, Trash2, Menu, X, ChevronRight, ShieldCheck, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  systemHealth: 'online' | 'offline' | 'loading';
  auditLogs?: any[];
  onResetSystem?: () => void;
}

export default function Header({
  currentTab,
  setCurrentTab,
  systemHealth,
  auditLogs = [],
  onResetSystem,
}: HeaderProps) {
  const tabs = ['Dashboard', 'Monitors', 'Security Logs', 'Admin'];

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [rotatingKeys, setRotatingKeys] = useState(false);
  const [keyVersion, setKeyVersion] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [readLogIds, setReadLogIds] = useState<Set<string>>(new Set());

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Derive unread counts from audit logs
  const unreadLogs = auditLogs.filter(log => !readLogIds.has(log.id));
  const hasUnreadAlerts = unreadLogs.some(log => log.status === 'BLOCKED' || log.status === 'PENDING');

  const handleMarkAllRead = () => {
    const allIds = auditLogs.map(log => log.id);
    setReadLogIds(new Set(allIds));
    showToast("All notifications marked as read");
  };

  const handleRotateKeys = () => {
    setRotatingKeys(true);
    setTimeout(() => {
      setRotatingKeys(false);
      setKeyVersion(prev => prev + 1);
      showToast("Consensus public keys rotated successfully!");
    }, 1200);
  };

  const handleResetSystemDB = () => {
    if (onResetSystem) {
      onResetSystem();
      setReadLogIds(new Set());
      showToast("Security firewall database reset to factory state");
      setIsProfileOpen(false);
    }
  };

  // Generate a mock key hash based on version
  const keyHash = `0xKEY_F42${keyVersion}_SHA256_SEC_LEAF_${839 + keyVersion * 12}`;

  return (
    <header className="border-b border-zinc-800 bg-black/90 px-6 py-4 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between relative">
        
        {/* Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-mono text-xs px-4 py-2.5 rounded-lg shadow-2xl flex items-center space-x-2"
            >
              <Check className="h-4 w-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Side: Brand and status */}
        <div className="flex items-center space-x-6">
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => {
              setCurrentTab('Dashboard');
              setIsMobileMenuOpen(false);
            }}
            title="Go to Dashboard"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              className="text-emerald-500 group-hover:text-emerald-400 transition-colors"
            >
              <Shield className="h-6 w-6 stroke-[2]" id="header-shield-icon" />
            </motion.div>
            <span className="font-mono text-lg font-bold tracking-wider text-emerald-400 uppercase group-hover:text-emerald-300 transition-colors">
              Intent Firewall
            </span>
          </div>

          <div className="hidden items-center space-x-2 md:flex">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                systemHealth === 'online' ? 'bg-emerald-400' : systemHealth === 'loading' ? 'bg-amber-400' : 'bg-rose-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                systemHealth === 'online' ? 'bg-emerald-500' : systemHealth === 'loading' ? 'bg-amber-500' : 'bg-rose-500'
              }`}></span>
            </span>
            <span className="font-mono text-xs font-semibold text-zinc-400">
              {systemHealth === 'online' ? 'Runtime Active' : systemHealth === 'loading' ? 'Establishing Tunnel...' : 'Gateway Offline'}
            </span>
          </div>
        </div>

        {/* Center: Navigation Tabs (Desktop) */}
        <nav className="hidden space-x-1 sm:flex">
          {tabs.map((tab) => {
            const isActive = currentTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                id={`tab-btn-${tab.toLowerCase().replace(' ', '-')}`}
                className="relative px-4 py-2 font-mono text-sm tracking-wide transition-colors"
              >
                <span className={`relative z-10 ${isActive ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}>
                  {tab}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-[-17px] left-0 right-0 h-[2px] bg-emerald-500"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Side: Security tools & Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          
          {/* Notifications Trigger */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsProfileOpen(false);
              }}
              className={`relative rounded-lg p-1.5 transition-colors cursor-pointer ${
                isNotificationsOpen 
                  ? 'bg-zinc-800 text-emerald-400' 
                  : 'text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
              }`}
              id="btn-notifications"
              title="Notifications & Alerts"
            >
              {hasUnreadAlerts && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
              )}
              <Bell className="h-5 w-5" />
            </button>

            {/* Notifications Dropdown Panel */}
            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl z-50 font-mono text-xs"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-emerald-400" />
                      <span className="font-bold text-zinc-200">Security Stream Alerts</span>
                    </div>
                    {auditLogs.length > 0 && (
                      <button 
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors uppercase font-bold text-left"
                      >
                        Acknowledge All
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {auditLogs.length === 0 ? (
                      <div className="py-8 text-center text-zinc-500 text-[11px] space-y-1">
                        <ShieldCheck className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                        <p>No transactions registered.</p>
                        <p className="text-[10px] text-zinc-600">Simulate action loops to seed firewall logs.</p>
                      </div>
                    ) : (
                      auditLogs.slice(0, 5).map((log) => {
                        return (
                          <div 
                            key={log.id}
                            onClick={() => {
                              setCurrentTab('Security Logs');
                              setIsNotificationsOpen(false);
                            }}
                            className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col space-y-1 text-left ${
                              log.status === 'BLOCKED'
                                ? 'bg-rose-950/20 border-rose-900/30 hover:border-rose-800/60'
                                : log.status === 'PENDING'
                                ? 'bg-amber-950/20 border-amber-900/30 hover:border-amber-800/60'
                                : 'bg-zinc-900/40 border-zinc-850 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold uppercase ${
                                log.status === 'BLOCKED'
                                  ? 'text-rose-400'
                                  : log.status === 'PENDING'
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}>
                                {log.status}
                              </span>
                              <span className="text-[9px] text-zinc-600">{log.timestamp}</span>
                            </div>
                            <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">
                              {log.action}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-zinc-900 pt-2.5 mt-3 text-center">
                    <button
                      onClick={() => {
                        setCurrentTab('Security Logs');
                        setIsNotificationsOpen(false);
                      }}
                      className="w-full text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider flex items-center justify-center space-x-1"
                    >
                      <span>Open full audit vaults</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings Trigger -> Navigates directly to Admin */}
          <button 
            onClick={() => {
              setCurrentTab('Admin');
              setIsMobileMenuOpen(false);
              showToast("Opened Policy Settings");
            }}
            className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
              currentTab === 'Admin' 
                ? 'bg-zinc-800 text-emerald-400' 
                : 'text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
            }`}
            id="btn-settings"
            title="Open Firewall Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
          
          {/* Profile Identity Trigger */}
          <div className="relative" ref={profileRef}>
            <div 
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center space-x-2 border-l border-zinc-800 pl-3 sm:pl-4 cursor-pointer select-none group"
              id="profile-indicator"
              title="Operator Identity & Consensus Node"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                isProfileOpen 
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/40' 
                  : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400 group-hover:border-emerald-600'
              }`}>
                <Lock className="h-4 w-4" />
              </div>
              <span className="hidden font-mono text-xs text-zinc-400 lg:inline-block group-hover:text-zinc-300 transition-colors">
                operator_node_01
              </span>
            </div>

            {/* Profile Dropdown */}
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2.5 w-72 rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl z-50 font-mono text-xs text-left"
                >
                  <div className="border-b border-zinc-800 pb-3 mb-3">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-bold">Secure Node Card</div>
                    <div className="text-sm font-bold text-zinc-200 mt-1 flex items-center justify-between">
                      <span>operator_node_01</span>
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-900/50 text-[9px] text-emerald-400 font-bold uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Active</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 text-[11px]">
                    <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-850 space-y-1.5 text-zinc-400">
                      <div className="flex justify-between">
                        <span>Cluster:</span>
                        <span className="text-zinc-300">firewall-mesh-prd</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Role:</span>
                        <span className="text-zinc-300">Operator Signer</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Consensus:</span>
                        <span className="text-zinc-300">2/3 Approved</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-zinc-500 font-bold uppercase text-[9px] flex items-center space-x-1">
                        <Key className="h-3 w-3" />
                        <span>Active Key Certificate</span>
                      </div>
                      <div className="p-2 bg-black rounded border border-zinc-900 text-zinc-500 text-[10px] break-all select-all hover:text-emerald-400 transition-colors cursor-pointer">
                        {keyHash}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <button
                        onClick={handleRotateKeys}
                        disabled={rotatingKeys}
                        className="w-full py-2 rounded bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-zinc-300 hover:text-emerald-400 transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${rotatingKeys ? 'animate-spin text-emerald-400' : ''}`} />
                        <span>{rotatingKeys ? 'Re-signing Keys...' : 'Rotate Node Keys'}</span>
                      </button>

                      {onResetSystem && (
                        <button
                          onClick={handleResetSystemDB}
                          className="w-full py-2 rounded bg-rose-950/20 border border-rose-900/40 hover:border-rose-500 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 transition-all cursor-pointer flex items-center justify-center space-x-2"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Reset Firewall Storage</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
            title="Toggle Menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

        </div>
      </div>

      {/* Mobile Navigation Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden mt-4 pt-4 border-t border-zinc-900 overflow-hidden"
          >
            <div className="flex flex-col space-y-2 pb-2">
              {tabs.map((tab) => {
                const isActive = currentTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setCurrentTab(tab);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg font-mono text-xs tracking-wider uppercase transition-colors ${
                      isActive 
                        ? 'bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 font-bold' 
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
