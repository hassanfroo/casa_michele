
import React, { useEffect, useState } from 'react';
import { X, CheckCircle } from 'lucide-react';

export const Button: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}> = ({ onClick, children, variant = 'primary', className = '', disabled, type = 'button' }) => {
  const base = "w-full h-14 flex items-center justify-center rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 px-6 text-lg";
  const styles = {
    primary: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
    secondary: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
    danger: "bg-red-500 text-white",
    ghost: "bg-transparent text-zinc-600 dark:text-zinc-400"
  };
  
  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const BottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-t-[32px] w-full max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between p-6 pb-2">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {children}
        </div>
        {footer && (
          <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const Toast: React.FC<{
  message: string;
  isVisible: boolean;
  onHide: () => void;
}> = ({ message, isVisible, onHide }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-max max-w-[90vw] animate-in slide-in-from-top fade-in duration-300">
      <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-full shadow-xl flex items-center gap-3 font-medium">
        <CheckCircle size={20} className="text-green-400" />
        {message}
      </div>
    </div>
  );
};

export const Badge: React.FC<{
  children: React.ReactNode;
  variant: 'success' | 'warning' | 'error' | 'neutral';
}> = ({ children, variant }) => {
  const styles = {
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${styles[variant]}`}>
      {children}
    </span>
  );
};
