import React from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CalendarProps {
  datesWithEmails: string[]; // ['YYYY-MM-DD', ...]
  onDateClick: (date: string) => void;
  selectedDate?: string;
}

export function Calendar({ datesWithEmails, onDateClick, selectedDate }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="glass rounded-2xl p-4 select-none">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-sm font-bold text-black/60 dark:text-white/60 tracking-tight">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-all">
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
          <div key={idx} className="text-[10px] font-bold text-black/20 dark:text-white/20 uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasEmails = datesWithEmails.includes(dateStr);
          const isSelected = selectedDate === dateStr;
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={idx}
              onClick={() => onDateClick(dateStr)}
              className={cn(
                "relative h-8 w-8 flex items-center justify-center rounded-lg text-xs transition-all",
                !isCurrentMonth && "text-black/10 dark:text-white/10",
                isCurrentMonth && "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10",
                isSelected && "bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-600 dark:hover:bg-blue-700",
                hasEmails && !isSelected && "font-bold text-blue-600 dark:text-blue-400"
              )}
            >
              {format(day, 'd')}
              {hasEmails && !isSelected && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
