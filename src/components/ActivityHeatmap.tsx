import { useEffect, useState, useMemo } from 'react';
import { GameRecord } from '@/types/models';
import { RecordRepository } from '@/repositories/RecordRepository';
import './ActivityHeatmap.css';

interface ActivityData {
  [date: string]: number; // date (YYYY-MM-DD) -> count of games played
}

interface CellData {
  date: Date;
  count: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  weekIndex: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'M', 'Tue', 'W', 'Thu', 'F', 'Sat'];

interface ActivityHeatmapProps {
  userId: string;
}

export default function ActivityHeatmap({ userId }: ActivityHeatmapProps) {
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecords = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      try {
        // Always use SupabaseStorageAdapter for public profiles
        const storageAdapter = new (await import('@/adapters/SupabaseStorageAdapter')).SupabaseStorageAdapter(userId);
        const repo = new RecordRepository(storageAdapter, userId);
        const allRecords = await repo.getAll();
        setRecords(allRecords);
      } catch (error) {
        console.error('Failed to load records:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadRecords();
  }, [userId]);

  const { activityData, cells, maxCount } = useMemo(() => {
    // Build activity map from records
    const activityMap: ActivityData = {};
    
    records.forEach(record => {
      // Use the createdAt field (ISO 8601 timestamp)
      const dateStr = record.createdAt.split('T')[0]; // Extract YYYY-MM-DD
      activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
    });

    // Calculate date range: last 52 weeks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (52 * 7 - 1)); // 364 days back (52 weeks)
    
    // Adjust start date to beginning of week (Sunday)
    const startDayOfWeek = startDate.getDay();
    if (startDayOfWeek !== 0) {
      startDate.setDate(startDate.getDate() - startDayOfWeek);
    }

    // Build cells array
    const cellsArray: CellData[] = [];
    let maxActivityCount = 0;
    
    const currentDate = new Date(startDate);
    let weekIndex = 0;
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const count = activityMap[dateStr] || 0;
      
      if (count > maxActivityCount) {
        maxActivityCount = count;
      }
      
      cellsArray.push({
        date: new Date(currentDate),
        count,
        dayOfWeek: currentDate.getDay(),
        weekIndex
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Move to next week column after Saturday
      if (currentDate.getDay() === 0 && currentDate <= endDate) {
        weekIndex++;
      }
    }

    return {
      activityData: activityMap,
      cells: cellsArray,
      maxCount: maxActivityCount
    };
  }, [records]);

  const getIntensityLevel = (count: number): number => {
    if (count === 0) return 0;
    if (maxCount === 0) return 1;
    
    const percentage = count / maxCount;
    if (percentage <= 0.25) return 1;
    if (percentage <= 0.5) return 2;
    if (percentage <= 0.75) return 3;
    return 4;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getMonthLabels = () => {
    const labels: { month: string; weekIndex: number }[] = [];
    let prevMonth = -1;
    let prevMonthLastWeekIndex = -1;
    let lastDayOfPrevMonth = null;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const month = cell.date.getMonth();
      // Detect last day of previous month
      if (prevMonth !== -1 && lastDayOfPrevMonth && cell.weekIndex > prevMonthLastWeekIndex) {
        labels.push({
          month: MONTHS[month],
          weekIndex: cell.weekIndex
        });
        lastDayOfPrevMonth = null;
      }
      // Update last day of month
      if (new Date(cell.date.getFullYear(), cell.date.getMonth() + 1, 0).getDate() === cell.date.getDate()) {
        prevMonthLastWeekIndex = cell.weekIndex;
        lastDayOfPrevMonth = cell;
        prevMonth = month;
      }
    }
    return labels;
  };

  if (isLoading) {
    return (
      <div className="activity-heatmap loading">
        <div className="loading-spinner"></div>
        <p>Loading activity...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="activity-heatmap empty">
        <p>No user selected</p>
      </div>
    );
  }

  const totalGames = records.length;
  const uniqueDays = Object.keys(activityData).length;
  const monthLabels = getMonthLabels();

  return (
    <div className="activity-heatmap">
      <div className="heatmap-header">
        <h3>Activity Over the Last Year</h3>
        <div className="heatmap-stats">
          <span>{totalGames} games played</span>
          <span>•</span>
          <span>{uniqueDays} active days</span>
        </div>
      </div>
      
      <div className="heatmap-unified-grid">
        {/* Month labels (row 1, columns 2+) */}
        {monthLabels.map((label, i) => {
          // Skip the first December label
          if (i === 0 && label.month === 'Dec') return null;
          return (
            <div
              key={`month-${i}`}
              className="month-label"
              style={{ gridColumn: label.weekIndex + 2, gridRow: 1 }}
            >
              {label.month}
            </div>
          );
        })}

        {/* Day labels (column 1, rows 2+) */}
        {DAYS.map((day, i) => (
          i % 2 === 1 && (
            <div
              key={`day-${day}`}
              className="day-label"
              style={{ gridRow: i + 2, gridColumn: 1 }}
            >
              {day}
            </div>
          )
        ))}

        {/* Heatmap cells (rows 2+, columns 2+) */}
        {cells.map((cell, i) => {
          const d = cell.date;
          const isLastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() === d.getDate();
          return (
            <div
              key={i}
              className={`heatmap-cell intensity-${getIntensityLevel(cell.count)}${isLastDayOfMonth ? ' heatmap-cell-last-of-month' : ''}`}
              style={{
                gridColumn: cell.weekIndex + 2,
                gridRow: cell.dayOfWeek + 2
              }}
              title={`${formatDate(cell.date)}: ${cell.count} ${cell.count === 1 ? 'game' : 'games'}`}
              data-count={cell.count}
              data-date={cell.date.toISOString().split('T')[0]}
            />
          );
        })}
      </div>
      
      <div className="heatmap-legend">
        <span className="legend-label">Less</span>
        <div className="legend-cells">
          {[0, 1, 2, 3, 4].map(level => (
            <div key={level} className={`legend-cell intensity-${level}`} />
          ))}
        </div>
        <span className="legend-label">More</span>
      </div>
    </div>
  );
}
