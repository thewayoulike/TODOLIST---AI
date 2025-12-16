import React, { useState, useEffect } from 'react';
import { Settings, Save, Lock, AlertCircle, HardDrive, CheckCircle2, Cloud, FileText } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [apiKey, setApiKey] = useState(settings.geminiApiKey || '');
  const [customInstructions, setCustomInstructions] = useState(settings.customInstructions || '');
  const [isDriveConnected, setIsDriveConnected] = useState(settings.googleDriveConnected);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(settings.geminiApiKey);
      setCustomInstructions(settings.customInstructions || '');
      setIsDriveConnected(settings.googleDriveConnected);
    }
  }, [isOpen, settings]);

  const handleConnectDrive = () => {
    setIsConnectingDrive(true);
    setTimeout(() => {
      setIsDriveConnected(true);
      setIsConnectingDrive(false);
    }, 2000);
  };

  const handleSave = () => {
    onSave({
      ...settings,
      geminiApiKey: apiKey,
      customInstructions: customInstructions, // Save the new instructions
      googleDriveConnected: isDriveConnected,
      googleDriveEmail: isDriveConnected ? 'user@example.com' : undefined
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Settings size={20} className="text-slate-700" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Settings size={20} className="rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* API Key Section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Gemini API Key</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={16} className="text-slate-400" />
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your AI Studio API Key"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <AlertCircle size={12} />
              Required for analysis.
            </p>
          </div>

          <hr className="border-slate-100" />

          {/* NEW: Custom Instructions Section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
              <FileText size={16} />
              Custom Scan Rules
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Tell the AI what to look for...&#10;Ex: 'Ignore marketing emails' or 'Only find financial deadlines' or 'Focus on messages from Alex'"
              className="block w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[100px]"
            />
            <p className="text-xs text-slate-500">
              These instructions will be added to the AI prompt every time you scan.
            </p>
          </div>

          <hr className="border-slate-100" />

          {/* Google Drive Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-700">Google Drive Sync</h3>
                <p className="text-xs text-slate-500">Backup your task list to the cloud</p>
              </div>
              <div className={`p-2 rounded-full ${isDriveConnected ? 'bg-green-100' : 'bg-slate-100'}`}>
                {isDriveConnected ? <CheckCircle2 size={20} className="text-green-600" /> : <Cloud size={20} className="text-slate-400" />}
              </div>
            </div>

            {isDriveConnected ? (
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                    {/* Drive Logo */}
                    <svg viewBox="0 0 87.3 78" className="w-6 h-6"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/><path d="M43.65 25l13.75-23.8c-1.35-.8-2.9-1.2-4.4-1.2h-18.5c-1.55 0-3.1.4-4.45 1.2l-13.75 23.8z" fill="#00AC47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 2.25-3.9c.8-1.4 1.2-2.95 1.2-4.5h-27.5l13.75 23.8c1.55 0 3.1-.4 4.45-1.2z" fill="#EA4335"/><path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-20 34.6c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00832D"/><path d="M73.55 76.8L59.8 53h-27.5l13.75 23.8c1.35.8 2.9 1.2 4.4 1.2h18.5c1.55 0 3.1-.4 4.45-1.2z" fill="#2684FC"/><path d="M43.65 25h27.5c0-1.55-.4-3.1-1.2-4.5l-20-34.6c-.8-1.4-1.95-2.5-3.3-3.3z" fill="#FFBA00"/></svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">Connected</div>
                    <div className="text-xs text-slate-500">taskmind_backup.json</div>
                  </div>
                </div>
                <button onClick={() => setIsDriveConnected(false)} className="text-xs font-medium text-red-600 hover:text-red-700 underline">Disconnect</button>
              </div>
            ) : (
              <button onClick={handleConnectDrive} disabled={isConnectingDrive} className="w-full flex items-center justify-center gap-2 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm text-slate-700">
                {isConnectingDrive ? <>Connect...</> : <><HardDrive size={16} /> Connect Google Drive</>}
              </button>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium text-sm hover:text-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 shadow-sm flex items-center gap-2"><Save size={16} /> Save Changes</button>
        </div>
      </div>
    </div>
  );
};
