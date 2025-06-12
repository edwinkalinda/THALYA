import React from 'react';

export const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex justify-end">
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const Tooltip = ({ content, children }) => (
  <div className="group relative">
    {children}
    <div className="invisible group-hover:visible absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 rounded text-sm whitespace-nowrap">
      {content}
    </div>
  </div>
);

export const Badge = ({ variant = 'default', children }) => {
  const variants = {
    default: 'bg-gray-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  };
  
  return (
    <span className={`${variants[variant]} px-2 py-1 rounded-full text-xs font-medium`}>
      {children}
    </span>
  );
};
