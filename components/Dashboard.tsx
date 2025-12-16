import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google'; // Import the hook
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { 
  LayoutDashboard, Mail, MessageSquare, CheckSquare, Loader2, Plus, RefreshCw,
  AlertCircle, Calendar, Sparkles, Link, Unlink, Settings as SettingsIcon, Cloud
} from 'lucide-react';
import { analyzeContent } from '../services/gemini';
import { MOCK_CHATS, MOCK_EMAILS } from '../utils/mockData'; // Removed MOCK_USERS
import { Task, Priority, SourceType, User, AppSettings } from '../types';
import { SettingsModal } from './SettingsModal';
// Removed AccountModal import

interface DashboardProps {
  // empty
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

export const Dashboard: React.FC<DashboardProps> = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'raw'>('overview');
  const [rawInput, setRawInput] = useState('');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Connection State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Settings & Drive State
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    geminiApiKey: '',
    googleDriveConnected: false,
    autoSave: true
  });
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);

  // Load settings/tasks/USER from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('taskmind_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    const savedTasks = localStorage.getItem('taskmind_tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
    const savedUser = localStorage.getItem('taskmind_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  // Persist User to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('taskmind_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('taskmind_user');
    }
  }, [currentUser]);

  // Save tasks to "Drive" (simulated via localStorage + delay)
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('taskmind_tasks', JSON.stringify(tasks));

      if (settings.googleDriveConnected && settings.autoSave) {
        setIsSavingToDrive(true);
        const timer = setTimeout(() => {
          setIsSavingToDrive(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [tasks, settings.googleDriveConnected, settings.autoSave]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('taskmind_settings', JSON.stringify(newSettings));
    
    if (newSettings.googleDriveConnected && !settings.googleDriveConnected) {
      setNotification({ message: 'Connected to Google Drive!', type: 'success' });
    }
  };

  // Stats for the "Last 7 Days" simulation
  const [stats, setStats] = useState({
    emailsScanned: 0,
    chatsScanned: 0
  });

  // --------------------------------------------------------------------------
  // GOOGLE LOGIN LOGIC
  // --------------------------------------------------------------------------
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setNotification({ message: 'Authenticating...', type: 'success' });

      try {
        // Fetch real user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoResponse.json();

        const realUser: User = {
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          avatarUrl: userInfo.picture,
          type: 'Personal' // Default to Personal
        };

        setCurrentUser(realUser);
        setNotification({ message: `Welcome, ${userInfo.given_name}!`, type: 'success' });
        
        // Immediately sync after login
        await performSync(realUser);

      } catch (error) {
        console.error('Login failed', error);
        setNotification({ message: 'Authentication failed', type: 'error' });
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setNotification({ message: 'Login Failed', type: 'error' });
    }
  });

  const initiateSync = async () => {
    if (!currentUser) {
      login(); // Trigger Google Login Popup
      return;
    }
    await performSync(currentUser);
  };

  const performSync = async (user: User) => {
    setLoading(true);
    setNotification({ message: 'Fetching recent messages...', type: 'success' });
    
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const combinedInput = `
        --- RECENT EMAILS (Last 7 Days) ---
        ${MOCK_EMAILS}
        
        --- RECENT CHATS (Last 7 Days) ---
        ${MOCK_CHATS}
      `;
      
      const newTasks = await analyzeContent(combinedInput, settings.geminiApiKey);
      
      setTasks(prev => {
        const existingIds = new Set(prev.map(p => p.title));
        const uniqueNew = newTasks.filter(t => !existingIds.has(t.title));
        return [...uniqueNew, ...prev];
      });
      
      setStats({ emailsScanned: 142, chatsScanned: 56 });
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setNotification({ message: 'Successfully synced!', type: 'success' });
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('API Key is missing')) {
        setNotification({ message: 'Missing API Key. Please add it in Settings.', type: 'error' });
        setShowSettings(true);
      } else {
        setNotification({ message: 'Failed to analyze content.', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setCurrentUser(null);
    setLastSynced(null);
    setTasks([]);
    setStats({ emailsScanned: 0, chatsScanned: 0 });
    setNotification({ message: 'Account disconnected.', type: 'success' });
    localStorage.removeItem('taskmind_user');
  };

  const handleManualAnalyze = async () => {
    if (!rawInput.trim()) return;
    setLoading(true);
    setNotification(null);
    try {
      const newTasks = await analyzeContent(rawInput, settings.geminiApiKey);
      setTasks(prev => [...newTasks, ...prev]);
      setNotification({ message: 'Analysis complete!', type: 'success' });
      setRawInput('');
      setActiveTab('overview');
    } catch (e: any) {
       if (e.message?.includes('API Key is missing')) {
        setNotification({ message: 'Missing API Key. Please add it in Settings.', type: 'error' });
        setShowSettings(true);
      } else {
        setNotification({ message: 'Analysis failed.', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskCompletion = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
  };

  const priorityData = [
    { name: 'High', value: tasks.filter(t => t.priority === Priority.HIGH && !t.isCompleted).length },
    { name: 'Medium', value: tasks.filter(t => t.priority === Priority.MEDIUM && !t.isCompleted).length },
    { name: 'Low', value: tasks.filter(t => t.priority === Priority.LOW && !t.isCompleted).length },
  ];

  const sourceData = [
    { name: 'Gmail', value: tasks.filter(t => t.sourceType === SourceType.GMAIL).length },
    { name: 'Chat', value: tasks.filter(t => t.sourceType === SourceType.CHAT).length },
    { name: 'Manual', value: tasks.filter(t => t.sourceType === SourceType.MANUAL).length },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2 font-bold text-xl text-blue-400">
            <Sparkles className="w-6 h-6" />
            TaskMind AI
          </div>
          <p className="text-xs text-slate-400 mt-1">Intelligence Dashboard</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={20} />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('raw')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'raw' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Plus size={20} />
            Add Data Source
          </button>
        </nav>

        <div className="p-4 bg-slate-800 m-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {currentUser ? 'Connected Account' : 'Sync Status'}
            </h3>
            {currentUser && (
               <button onClick={handleDisconnect} className="text-slate-500 hover:text-white" title="Disconnect">
                 <Unlink size={12} />
               </button>
            )}
          </div>

          {currentUser ? (
            <div className="mb-4 flex items-center gap-3 pb-4 border-b border-slate-700">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full" />
              ) : (
                <div className={`w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs`}>
                  {currentUser.name.charAt(0)}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{currentUser.name}</div>
                <div className="text-xs text-slate-400 truncate">{currentUser.email}</div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                <Mail size={14} /> Gmail
              </span>
              <span className={`w-2 h-2 rounded-full ${currentUser ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-600'}`}></span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                <MessageSquare size={14} /> G-Chat
              </span>
              <span className={`w-2 h-2 rounded-full ${currentUser ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-600'}`}></span>
            </div>
            <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700">
              {currentUser ? `Last synced: ${lastSynced || 'Just now'}` : 'Not connected'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
             <h1 className="text-xl font-semibold text-slate-800">
              {activeTab === 'overview' ? 'My Intelligent To-Do List' : 'Add New Context'}
            </h1>
            {settings.googleDriveConnected && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded border border-green-100 text-xs text-green-700">
                {isSavingToDrive ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Cloud size={12} />
                    Saved to Drive
                  </>
                )}
              </div>
            )}
          </div>
         
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="Settings"
            >
              <SettingsIcon size={20} />
            </button>
            <button 
              onClick={() => initiateSync()}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                currentUser 
                  ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : currentUser ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Link className="w-4 h-4" />
              )}
              {loading 
                ? (currentUser ? 'Syncing...' : 'Connecting...') 
                : (currentUser ? 'Sync Recent' : 'Connect with Google')
              }
            </button>
          </div>
        </header>

        {/* Notification Toast */}
        {notification && (
          <div className={`absolute top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in-down flex items-center gap-2 ${notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
            {notification.type === 'error' ? <AlertCircle size={16} /> : <CheckSquare size={16} />}
            {notification.message}
            <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-75">×</button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' ? (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Emails Scanned</h3>
                  <div className="text-2xl font-bold text-slate-800">{stats.emailsScanned}</div>
                  <div className="text-xs text-green-600 mt-1 flex items-center">
                    {currentUser ? 'From last 7 days' : 'Waiting for sync...'}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Chats Processed</h3>
                  <div className="text-2xl font-bold text-slate-800">{stats.chatsScanned}</div>
                  <div className="text-xs text-green-600 mt-1 flex items-center">
                    {currentUser ? 'From last 7 days' : 'Waiting for sync...'}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Pending Tasks</h3>
                  <div className="text-2xl font-bold text-slate-800">{tasks.filter(t => !t.isCompleted).length}</div>
                  <div className="text-xs text-blue-600 mt-1 flex items-center">
                    {tasks.filter(t => t.priority === Priority.HIGH && !t.isCompleted).length} High Priority
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Task List Column */}
                <div className="lg:col-span-2 space-y-4">
                  <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                    <CheckSquare size={18} />
                    Action Items
                  </h2>
                  
                  {tasks.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${currentUser ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                        {currentUser ? <Sparkles className="w-8 h-8 text-indigo-500" /> : <Link className="w-8 h-8 text-slate-400" />}
                      </div>
                      <h3 className="text-lg font-medium text-slate-800 mb-2">
                        {currentUser ? 'All caught up!' : 'Connect your accounts'}
                      </h3>
                      <p className="text-slate-500 max-w-sm mx-auto mb-6">
                        {currentUser 
                          ? 'We scanned your history and found no pending tasks, or you have completed them all.' 
                          : 'Securely connect your Gmail and Google Chat to let AI extract your to-do list automatically.'
                        }
                      </p>
                      <button 
                        onClick={() => initiateSync()}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                      >
                        {currentUser ? 'Scan Again' : 'Connect & Scan'}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
                      {tasks.map(task => (
                        <div key={task.id} className={`p-4 hover:bg-slate-50 transition-colors group ${task.isCompleted ? 'opacity-50' : ''}`}>
                          <div className="flex items-start gap-4">
                            <button 
                              onClick={() => toggleTaskCompletion(task.id)}
                              className={`mt-1 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${task.isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 hover:border-blue-500'}`}
                            >
                              {task.isCompleted && <CheckSquare size={14} />}
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className={`font-medium text-slate-900 truncate ${task.isCompleted ? 'line-through text-slate-500' : ''}`}>
                                  {task.title}
                                </h3>
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                                  task.priority === Priority.HIGH ? 'bg-red-100 text-red-700' :
                                  task.priority === Priority.MEDIUM ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {task.priority}
                                </span>
                              </div>
                              
                              <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                              
                              <div className="flex items-center gap-4 text-xs text-slate-400">
                                <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                                  {task.sourceType === SourceType.GMAIL ? <Mail size={12} /> : task.sourceType === SourceType.CHAT ? <MessageSquare size={12} /> : <LayoutDashboard size={12} />}
                                  {task.sourceType}
                                </span>
                                {task.dueDate && (
                                  <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                    <Calendar size={12} />
                                    Due: {task.dueDate}
                                  </span>
                                )}
                                <span className="ml-auto">
                                  Confidence: {task.confidenceScore}%
                                </span>
                              </div>
                              
                              <div className="mt-3 p-2 bg-slate-50 rounded border border-slate-100 text-xs text-slate-500 italic">
                                " {task.sourceContext} "
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Analytics Column */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-semibold text-slate-800 mb-4">Task Distribution</h3>
                    {tasks.length > 0 ? (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={priorityData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {priorityData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index === 1 ? '#f59e0b' : '#3b82f6'} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div>High</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div>Med</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Low</div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                        No data yet
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                     <h3 className="font-semibold text-slate-800 mb-4">Sources</h3>
                     {tasks.length > 0 ? (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sourceData}>
                              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis hide />
                              <Tooltip cursor={{fill: 'transparent'}} />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {sourceData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                     ) : (
                      <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                        No data yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* RAW INPUT TAB */
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-2">Manual Context Analysis</h2>
                  <p className="text-slate-500 text-sm">
                    Paste email threads, chat logs, or meeting notes below. 
                    Gemini AI will analyze the text to extract action items automatically.
                  </p>
                </div>
                
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="Paste your email content or chat logs here..."
                  className="w-full h-64 p-4 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none font-mono text-sm mb-6"
                ></textarea>
                
                <div className="flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setRawInput('')}
                    className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={handleManualAnalyze}
                    disabled={loading || !rawInput.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Analyze & Extract Tasks
                  </button>
                </div>
              </div>

              <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <span className="bg-blue-200 text-blue-700 text-xs px-2 py-0.5 rounded font-bold">TIP</span>
                  How to use
                </h3>
                <ul className="list-disc list-inside text-sm text-blue-800 space-y-1 ml-1">
                  <li>Copy text from any digital source (Slack, Teams, Gmail, Docs).</li>
                  <li>Gemini will look for keywords like "deadline", "urgent", "please do X".</li>
                  <li>It automatically determines priority based on the tone of the message.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
