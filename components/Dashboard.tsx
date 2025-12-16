import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { 
  LayoutDashboard, Mail, MessageSquare, CheckSquare, Loader2, Plus, RefreshCw,
  AlertCircle, Calendar, Sparkles, Link, Unlink, Settings as SettingsIcon, Cloud, Trash2
} from 'lucide-react';
import { analyzeContent } from '../services/gemini';
import { Task, Priority, SourceType, User, AppSettings } from '../types';
import { SettingsModal } from './SettingsModal';

// --- HELPER: Fetch Real Gmail ---
const fetchRealGmail = async (accessToken: string) => {
  try {
    const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    // If this fails with 403, it means permissions are missing
    if (!listResponse.ok) throw new Error(`Gmail API Error: ${listResponse.status}`);
    
    const listData = await listResponse.json();
    if (!listData.messages) return null;

    const emails = await Promise.all(listData.messages.map(async (msg: any) => {
      const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const detail = await detailResponse.json();
      
      const subject = detail.payload.headers.find((h: any) => h.name === 'Subject')?.value || '(No Subject)';
      const from = detail.payload.headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
      
      return `Subject: ${subject}\nFrom: ${from}\nSnippet: ${detail.snippet}\n---`;
    }));

    return emails.join('\n');
  } catch (error) {
    console.error("Error fetching Gmail:", error);
    return null;
  }
};

// --- HELPER: Save to Google Drive ---
const saveToDrive = async (tasks: Task[], accessToken: string) => {
  const fileContent = JSON.stringify(tasks, null, 2);
  const metadata = {
    name: 'taskmind_backup.json',
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([fileContent], { type: 'application/json' }));

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  
  if (!response.ok) throw new Error('Drive upload failed');
};

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

export const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'raw'>('overview');
  const [rawInput, setRawInput] = useState('');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Connection State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null); 
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Settings & Drive State
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    geminiApiKey: '',
    googleDriveConnected: false,
    autoSave: true
  });
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);

  // Load from LocalStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('taskmind_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    
    const savedTasks = localStorage.getItem('taskmind_tasks');
    if (savedTasks) setTasks(JSON.parse(savedTasks));
    
    const savedUser = localStorage.getItem('taskmind_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  // Save Tasks & Sync to Drive
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('taskmind_tasks', JSON.stringify(tasks));

      if (settings.googleDriveConnected && settings.autoSave && accessToken) {
        setIsSavingToDrive(true);
        saveToDrive(tasks, accessToken).catch(console.error);
      }
    }
  }, [tasks, settings.googleDriveConnected, settings.autoSave, accessToken]);

  // Persist User
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('taskmind_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('taskmind_user');
    }
  }, [currentUser]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('taskmind_settings', JSON.stringify(newSettings));
  };

  const [stats, setStats] = useState({ emailsScanned: 0, chatsScanned: 0 });

  // --- GOOGLE LOGIN (CRITICAL FIX) ---
  const login = useGoogleLogin({
    // WE MUST ASK FOR GMAIL PERMISSION HERE:
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.file',
    
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setAccessToken(tokenResponse.access_token);
      setNotification({ message: 'Authenticating...', type: 'success' });

      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoResponse.json();

        const realUser: User = {
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          avatarUrl: userInfo.picture,
          type: 'Personal'
        };

        setCurrentUser(realUser);
        handleSaveSettings({ ...settings, googleDriveConnected: true });

        setNotification({ message: `Welcome, ${userInfo.given_name}!`, type: 'success' });
        
        // Sync immediately upon login
        await performSync(tokenResponse.access_token);

      } catch (error) {
        console.error('Login failed', error);
        setNotification({ message: 'Authentication failed', type: 'error' });
      } finally {
        setLoading(false);
      }
    },
    onError: () => setNotification({ message: 'Login Failed', type: 'error' })
  });

  const initiateSync = async () => {
    if (!accessToken) {
      login();
      return;
    }
    await performSync(accessToken);
  };

  // --- MAIN SYNC LOGIC ---
  const performSync = async (token: string) => {
    setLoading(true);
    setNotification({ message: 'Scanning real emails...', type: 'success' });
    
    try {
      // 1. Fetch Real Emails ONLY
      const emailContent = await fetchRealGmail(token);
      
      if (!emailContent) {
        setNotification({ message: 'No recent emails found (or permission denied).', type: 'error' });
        setLoading(false);
        return;
      }
      
      // 2. Build Prompt without Mock Data
      const combinedInput = `
        You are my personal assistant. Analyze these recent emails to find actionable tasks.
        If there are no clear tasks, return an empty array. Do not invent tasks.
        
        EMAILS FROM INBOX:
        ${emailContent}
      `;
      
      // 3. Analyze with Gemini
      const newTasks = await analyzeContent(combinedInput, settings.geminiApiKey);
      
      // 4. OVERWRITE tasks
      setTasks(newTasks);
      
      setStats({ 
        emailsScanned: 10, 
        chatsScanned: 0 
      });
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setNotification({ message: `Found ${newTasks.length} tasks from Gmail!`, type: 'success' });

    } catch (e: any) {
      console.error(e);
      setNotification({ message: 'Analysis failed. Check console for 403 errors.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setCurrentUser(null);
    setAccessToken(null);
    setTasks([]);
    setStats({ emailsScanned: 0, chatsScanned: 0 });
    setNotification({ message: 'Disconnected.', type: 'success' });
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure? This will wipe all current tasks.')) {
      setTasks([]);
      localStorage.removeItem('taskmind_tasks');
      setStats({ emailsScanned: 0, chatsScanned: 0 });
      setNotification({ message: 'All data cleared.', type: 'success' });
    }
  };

  const handleManualAnalyze = async () => {
    if (!rawInput.trim()) return;
    setLoading(true);
    try {
      const newTasks = await analyzeContent(rawInput, settings.geminiApiKey);
      setTasks(prev => [...newTasks, ...prev]);
      setNotification({ message: 'Analysis complete!', type: 'success' });
      setRawInput('');
      setActiveTab('overview');
    } catch (e: any) {
      setNotification({ message: 'Analysis failed.', type: 'error' });
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
            <div className="mb-4">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-700">
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
              
              <button 
                onClick={handleClearData}
                className="w-full mt-3 flex items-center justify-center gap-2 text-xs text-red-400 hover:bg-slate-700 hover:text-red-300 py-2 rounded transition-colors"
              >
                <Trash2 size={12} />
                Clear All Data
              </button>
            </div>
          ) : null}

          <div className="space-y-3 mt-4">
             <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                <Mail size={14} /> Gmail
              </span>
              <span className={`w-2 h-2 rounded-full ${currentUser ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-600'}`}></span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
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
              onClick={initiateSync}
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
                ? (currentUser ? 'Scanning...' : 'Connecting...') 
                : (currentUser ? 'Scan Gmail' : 'Connect Account')
              }
            </button>
          </div>
        </header>

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Emails Scanned</h3>
                  <div className="text-2xl font-bold text-slate-800">{stats.emailsScanned}</div>
                  <div className="text-xs text-green-600 mt-1 flex items-center">
                    {currentUser ? 'From recent inbox' : 'Waiting for sync...'}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Chats Processed</h3>
                  <div className="text-2xl font-bold text-slate-800">{stats.chatsScanned}</div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center">
                     (Chat API requires Work account)
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
                        {currentUser ? 'Ready to scan' : 'Connect your accounts'}
                      </h3>
                      <p className="text-slate-500 max-w-sm mx-auto mb-6">
                        {currentUser 
                          ? 'Click the button above to scan your recent emails for tasks.' 
                          : 'Securely connect your Gmail to let AI extract your to-do list automatically.'
                        }
                      </p>
                      <button 
                        onClick={initiateSync}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                      >
                        {currentUser ? 'Scan Inbox Now' : 'Connect & Scan'}
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
                
                {/* Charts Area */}
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
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="Paste your content here..."
                  className="w-full h-64 p-4 rounded-lg border border-slate-200 focus:border-blue-500 outline-none resize-none font-mono text-sm mb-6"
                ></textarea>
                
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setRawInput('')} className="px-4 py-2 text-slate-500 text-sm">Clear</button>
                  <button 
                    onClick={handleManualAnalyze}
                    disabled={loading || !rawInput.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Analyze & Extract Tasks
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
