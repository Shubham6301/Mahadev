import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

interface SubmissionCalendarProps {
  submissions: Array<{
    date: string;
    status: string;
  }>;
}

const SubmissionCalendar: React.FC<SubmissionCalendarProps> = ({ submissions }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Utility: convert date to IST date string (YYYY-MM-DD)
  const toISTDateString = (date: Date) => {
    const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5.5 hours in ms
    const istDate = new Date(date.getTime() + istOffsetMs);
    return istDate.toISOString().split('T')[0];
  };

  // Group submissions by IST date
  const submissionsByDate = useMemo(() => {
    return submissions.reduce((acc, submission) => {
      const date = new Date(submission.date);
      const localDate = toISTDateString(date);

      if (!acc[localDate]) {
        acc[localDate] = [];
      }
      acc[localDate].push(submission);
      return acc;
    }, {} as Record<string, Array<{ date: string; status: string }>>);
  }, [submissions]);

  // Submission intensity
  const getSubmissionIntensity = (date: string) => {
    const daySubmissions = submissionsByDate[date] || [];
    if (daySubmissions.length === 0) return 0;
    if (daySubmissions.length <= 1) return 1;
    if (daySubmissions.length <= 3) return 2;
    if (daySubmissions.length <= 5) return 3;
    return 4;
  };

  // Color by intensity
  const getIntensityColor = (intensity: number) => {
    switch (intensity) {
      case 0:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
      case 1:
        return 'bg-green-300 dark:bg-green-400/30 border-green-400 dark:border-green-400/50';
      case 2:
        return 'bg-green-400 dark:bg-green-300/40 border-green-500 dark:border-green-300/70';
      case 3:
        return 'bg-green-500 dark:bg-green-300/50 border-green-600 dark:border-green-300/90';
      case 4:
        return 'bg-green-600 dark:bg-green-200/60 border-green-700 dark:border-green-200/100';
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  // Year data (GitHub-style calendar) — fully based on selectedYear
  const yearData = useMemo(() => {
    const startDate = new Date(selectedYear, 0, 1); // 1 Jan selectedYear (local)
    const endDate = new Date(selectedYear, 11, 31); // 31 Dec selectedYear
    const weeks: Array<
      Array<{
        date: Date;
        dateStr: string;
        intensity: number;
        submissions: Array<{ date: string; status: string }>;
        isCurrentYear: boolean;
      }>
    > = [];

    // Sunday before (or same) as 1 Jan
    const firstSunday = new Date(startDate);
    firstSunday.setDate(startDate.getDate() - startDate.getDay());

    let currentDate = new Date(firstSunday);

    while (currentDate <= endDate || currentDate.getDay() !== 0) {
      const week: typeof weeks[number] = [];

      for (let i = 0; i < 7; i++) {
        const dateCopy = new Date(currentDate); // copy
        const dateStr = toISTDateString(dateCopy);
        const intensity = getSubmissionIntensity(dateStr);
        const daySubmissions = submissionsByDate[dateStr] || [];

        week.push({
          date: dateCopy,
          dateStr,
          intensity,
          submissions: daySubmissions,
          isCurrentYear: dateCopy.getFullYear() === selectedYear,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      weeks.push(week);

      // Break after passing end of year and finishing a full week
      if (currentDate > endDate && currentDate.getDay() === 0) break;
    }

    return weeks;
  }, [selectedYear, submissionsByDate]);

  // Stats (global: all years, IST-based)
  const stats = useMemo(() => {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;

    // 1) Lifetime submissions in IST
    const istSubmissions = submissions.map((s) => {
      const date = new Date(s.date);
      const istDate = new Date(date.getTime() + istOffsetMs);
      return {
        ...s,
        istDate,
        istDateStr: toISTDateString(istDate),
      };
    });

    // 2) Total active days (unique IST days across all years)
    const activeDays = new Set(istSubmissions.map((s) => s.istDateStr)).size;

    // 3) Global max streak (LeetCode style, across all years)
    const maxStreak = () => {
      const dates = Array.from(
        new Set(istSubmissions.map((s) => s.istDateStr))
      ).sort(); // YYYY-MM-DD

      if (dates.length === 0) return 0;

      let maxStreak = 0;
      let currentStreak = 0;
      let lastDate: Date | null = null;

      for (const dateStr of dates) {
        const date = new Date(dateStr + 'T00:00:00.000Z');

        if (lastDate) {
          const diffDays =
            (date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

          if (diffDays === 1) {
            currentStreak++;
          } else {
            maxStreak = Math.max(maxStreak, currentStreak);
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }

        lastDate = date;
      }

      return Math.max(maxStreak, currentStreak);
    };

    return {
      totalSubmissions: istSubmissions.length, // lifetime submissions
      activeDays,                              // lifetime active days
      maxStreak: maxStreak(),                  // lifetime max streak
    };
  }, [submissions]);

  const monthLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Available years from submissions (IST-based)
  const availableYears = useMemo(() => {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const years = new Set(
      submissions.map((s) => {
        const date = new Date(s.date);
        const istDate = new Date(date.getTime() + istOffsetMs);
        return istDate.getFullYear();
      })
    );
    const arr = Array.from(years).sort((a, b) => b - a);
    // ensure current year appears at least once
    if (!arr.includes(new Date().getFullYear())) {
      arr.unshift(new Date().getFullYear());
    }
    return arr;
  }, [submissions]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            <span className="text-2xl font-bold">
              {stats.totalSubmissions}
            </span>{' '}
            submissions (submissions in the past one year
)
          </h3>
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <span>
            Total active days:{' '}
            <strong className="text-gray-900 dark:text-gray-100">
              {stats.activeDays}
            </strong>
          </span>
          <span>
            Max streak:{' '}
            <strong className="text-gray-900 dark:text-gray-100">
              {stats.maxStreak}
            </strong>
          </span>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-transparent border border-gray-300 dark:border-gray-600 rounded px-3 py-1 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
            >
              {availableYears.map((year) => (
                <option
                  key={year}
                  value={year}
                  className="bg-white dark:bg-gray-800"
                >
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex mb-2">
            <div className="w-8"></div>
            {monthLabels.map((month) => (
              <div
                key={month}
                className="flex-1 min-w-[40px] text-xs text-gray-500 dark:text-gray-400 text-center"
              >
                {month}
              </div>
            ))}
          </div>

          {/* Day labels + grid */}
          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col space-y-1 mr-2">
              {dayLabels.map((day, index) => (
                <div
                  key={day}
                  className={`h-3 text-xs text-gray-500 dark:text-gray-400 flex items-center ${
                    index % 2 === 0 ? '' : 'opacity-0'
                  }`}
                >
                  {index % 2 === 0 ? day.slice(0, 3) : ''}
                </div>
              ))}
            </div>

            {/* Contribution grid */}
            <div className="flex space-x-1 flex-1">
              {yearData.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col space-y-1">
                  {week.map((day, dayIndex) => (
                    <div
                      key={dayIndex}
                      className={`w-3 h-3 rounded-sm border ${getIntensityColor(
                        day.intensity
                      )} ${
                        !day.isCurrentYear ? 'opacity-30' : ''
                      } hover:scale-110 transition-transform cursor-pointer`}
                      title={`${day.date.toDateString()}: ${day.submissions.length} submissions`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end mt-4 space-x-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Less
            </span>
            <div className="flex space-x-1">
              {[0, 1, 2, 3, 4].map((intensity) => (
                <div
                  key={intensity}
                  className={`w-3 h-3 rounded-sm ${getIntensityColor(
                    intensity
                  )}`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              More
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionCalendar;
