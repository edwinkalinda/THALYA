import React, { useState, useEffect } from 'react';
import { Box, Container, Grid, Paper, Typography } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { db, analytics } from '../../config/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { logEvent } from 'firebase/analytics';

const AnalyticsPage = () => {
  const [analyticsData, setAnalyticsData] = useState({
    monthlySales: [],
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        // Track page view
        logEvent(analytics, 'screen_view', {
          screen_name: 'Analytics',
          screen_class: 'AnalyticsPage'
        });

        // Fetch real data from Firestore
        const salesQuery = query(
          collection(db, 'sales'),
          orderBy('date', 'desc'),
          limit(6)
        );

        const salesSnapshot = await getDocs(salesQuery);
        if (salesSnapshot.empty) {
          throw new Error('No sales data available');
        }

        const salesData = salesSnapshot.docs.map(doc => ({
          month: new Date(doc.data().date.toDate()).toLocaleString('default', { month: 'short' }),
          sales: Number(doc.data().amount) || 0
        }));

        // Calculate totals with proper number handling
        const totalRev = salesData.reduce((acc, curr) => acc + curr.sales, 0);
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        const orderCount = ordersSnapshot.size;

        setAnalyticsData({
          monthlySales: salesData.reverse(),
          totalRevenue: totalRev,
          totalOrders: orderCount,
          averageOrderValue: orderCount ? Number((totalRev / orderCount).toFixed(2)) : 0
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Analytics Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Summary Statistics */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6">Total Revenue</Typography>
            <Typography variant="h4">${analyticsData.totalRevenue}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6">Total Orders</Typography>
            <Typography variant="h4">{analyticsData.totalOrders}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6">Average Order Value</Typography>
            <Typography variant="h4">${analyticsData.averageOrderValue}</Typography>
          </Paper>
        </Grid>

        {/* Sales Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Monthly Sales
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.monthlySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default AnalyticsPage;
