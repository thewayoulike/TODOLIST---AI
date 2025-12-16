import React from 'react';
import { User } from '../types';
import { UserCircle2, Plus, X } from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (user: User) => void;
  users: User[];
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, onSelect, users }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center border-b border-slate-100">
          <div className="w-12 h-12 bg-white rounded-full mx-auto mb-4 flex items-center justify-center">
            {/* Google G Logo SVG */}
            <svg viewBox="0 0 24 24" className="w-8 h-8">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-slate-800">Choose an account</h2>
          <p className="text-slate-500 text-sm mt-1">to continue to TaskMind AI</p>
        </div>

        <div className="py-2">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelect(user)}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
            >
              <div className={`w-10 h-10 rounded-full ${user.avatarColor} text-white flex items-center justify-center font-medium text-lg`}>
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900">{user.name}</div>
                <div className="text-sm text-slate-500 truncate">{user.email}</div>
              </div>
              <div className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">
                {user.type}
              </div>
            </button>
          ))}
          
          <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left text-slate-600">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <UserCircle2 size={24} />
            </div>
            <div className="font-medium">Use another account</div>
          </button>
        </div>

        <div className="p-4 bg-slate-50 text-xs text-slate-500 text-center border-t border-slate-100">
          To continue, Google will share your name, email address, and language preference with TaskMind AI.
          <div className="mt-4 flex justify-center">
             <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded font-medium transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};
