"use client";

interface Props {
  onEmergencyClick?: () => void;
  pageTitle?: string;
}

export default function TopNav({ onEmergencyClick, pageTitle }: Props) {
  return (
    <header className="flex justify-between items-center h-16 px-gutter w-full sticky top-0 z-50 bg-surface border-b border-outline-variant">
      {/* Left: brand + search */}
      <div className="flex items-center gap-6">
        <span className="text-headline-md font-headline font-bold text-on-primary-fixed-variant tracking-wide">
          PREVENTIVE INTEL
        </span>
        {pageTitle && (
          <span className="hidden md:block text-on-surface-variant text-body-sm font-body">
            / {pageTitle}
          </span>
        )}
        <div className="relative hidden lg:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            className="pl-10 pr-4 py-1.5 bg-surface-container-low border-none rounded-lg text-body-sm w-64 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-on-surface placeholder:text-on-surface-variant"
            placeholder="Search fleet..."
            type="text"
          />
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-surface-container-low rounded-full text-secondary transition-colors duration-150">
          <span className="material-symbols-outlined">notifications</span>
        </button>

        {/* Emergency trigger */}
        <button
          onClick={onEmergencyClick}
          className="p-2 bg-error-container text-on-error-container rounded-full hover:opacity-80 transition-opacity"
          aria-label="Open emergency alert"
          title="Emergency"
        >
          <span className="material-symbols-outlined">emergency</span>
        </button>

        <button className="p-2 hover:bg-surface-container-low rounded-full text-secondary transition-colors duration-150">
          <span className="material-symbols-outlined">settings</span>
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full border border-outline-variant bg-secondary flex items-center justify-center text-on-secondary font-bold text-xs ml-1">
          OP
        </div>
      </div>
    </header>
  );
}
