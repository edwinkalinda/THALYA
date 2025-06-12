import React, { useState, useRef, useEffect } from 'react';

export const CommandPalette = ({ isOpen, onClose, commands }) => {
  // Add prop validation
  if (!Array.isArray(commands)) {
    console.error('Commands must be an array');
    return null;
  }

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const commandsRef = useRef(null);

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/80" role="dialog" aria-modal="true">
      <div className="fixed inset-x-0 top-20 mx-auto max-w-2xl">
        <div className="bg-gray-800 rounded-lg shadow-2xl">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full p-4 bg-transparent border-b border-gray-700 focus:outline-none"
            placeholder="Type a command..."
            aria-label="Search commands"
          />
          <div ref={commandsRef} className="max-h-96 overflow-y-auto" role="listbox">
            {filteredCommands.map((cmd, index) => (
              <button
                key={index}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className={`w-full p-4 text-left hover:bg-gray-700 ${
                  index === selectedIndex ? 'bg-gray-700' : ''
                }`}
                role="option"
                aria-selected={index === selectedIndex}
              >
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

CommandPalette.defaultProps = {
  commands: [],
  isOpen: false,
  onClose: () => {}
};
