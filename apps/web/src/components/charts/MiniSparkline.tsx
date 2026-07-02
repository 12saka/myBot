'use client';

import React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  showTooltip?: boolean;
}

export function MiniSparkline({
  data,
  color = '#8b5cf6',
  height = 48,
  showTooltip = false,
}: SparklineProps) {
  const chartData = data.map((v, i) => ({ v, i }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        {showTooltip && (
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="glass-card px-2 py-1 text-xs text-slate-200 rounded">
                  {payload[0].value?.toString()}
                </div>
              ) : null
            }
          />
        )}
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
