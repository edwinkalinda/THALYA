import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';

export const RealTimeMetrics = ({ businessId }) => {
  const [metrics, setMetrics] = useState({
    callsPerHour: [],
    successRate: 0,
    averageDuration: 0
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:5000/metrics/${businessId}`);
    
    ws.onerror = (error) => {
      setError('WebSocket connection failed');
      setIsLoading(false);
    };

    ws.onopen = () => setIsLoading(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMetrics(data);
    };

    return () => ws.close();
  }, [businessId]);

  if (error) return <div className="text-red-400">{error}</div>;
  if (isLoading) return <div>Loading metrics...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3>Success Rate</h3>
          <p className="text-2xl font-bold">{metrics.successRate}%</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3>Avg Duration</h3>
          <p className="text-2xl font-bold">{metrics.averageDuration}s</p>
        </div>
      </div>
      {metrics.callsPerHour.length > 0 && (
        <Line data={{ 
          labels: metrics.callsPerHour.map(d => d.hour),
          datasets: [{
            data: metrics.callsPerHour.map(d => d.calls),
            borderColor: '#3b82f6'
          }]
        }} />
      )}
    </div>
  );
};
