import { asyncHandler } from '../../middlewares/errorHandler';
import User from '../../models/User';
import Expert from '../../models/Expert';
import Appointment from '../../models/Appointment';
import Payment from '../../models/Payment';
import UserSubscription from '../../models/UserSubscription';

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
export const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    // Get basic counts
    const totalUsers = await User.countDocuments({ userType: 'user' });
    const totalExperts = await Expert.countDocuments();
    const activeBookings = await Appointment.countDocuments({ 
      status: { $in: ['pending', 'confirmed'] } 
    });
    
    // Get revenue stats
    const revenueStats = await Payment.aggregate([
      {
        $match: { 
          status: 'completed',
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const monthlyRevenue = revenueStats[0]?.total || 0;

    // Get user growth data (last 8 months)
    const userGrowthData = await User.aggregate([
      {
        $match: {
          userType: 'user',
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 8))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get revenue data (last 8 months)
    const revenueData = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 8))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          bookings: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get booking counts by month
    const bookingData = await Appointment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 8))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get category/specialization distribution
    const categoryData = await Expert.aggregate([
      {
        $group: {
          _id: '$specialization',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Get recent bookings (last 5)
    const recentBookings = await Appointment.find()
      .populate('user', 'firstName lastName email')
      .populate('expert', 'firstName lastName specialization')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id sessionDate startTime status price consultationMethod')
      .lean();

    // Get top performing experts
    const topExperts = await Appointment.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'confirmed'] }
        }
      },
      {
        $group: {
          _id: '$expert',
          sessions: { $sum: 1 },
          revenue: { $sum: '$price' }
        }
      },
      {
        $sort: { revenue: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'experts',
          localField: '_id',
          foreignField: '_id',
          as: 'expertDetails'
        }
      },
      {
        $unwind: '$expertDetails'
      },
      {
        $project: {
          expertId: '$_id',
          name: {
            $concat: [
              { $ifNull: ['$expertDetails.firstName', ''] },
              ' ',
              { $ifNull: ['$expertDetails.lastName', ''] }
            ]
          },
          sessions: 1,
          revenue: 1,
          rating: { $ifNull: ['$expertDetails.averageRating', 0] }
        }
      }
    ]);

    // Format month names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Format user growth data
    const formattedUserGrowth = [];
    const userGrowthMap = new Map();
    userGrowthData.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      userGrowthMap.set(key, item.count);
    });

    // Get cumulative user counts
    let cumulativeUsers = totalUsers;
    for (let i = 7; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      const newUsers = userGrowthMap.get(key) || 0;
      cumulativeUsers -= newUsers;
      formattedUserGrowth.push({
        name: monthNames[month - 1],
        users: cumulativeUsers + newUsers
      });
      cumulativeUsers += newUsers;
    }

    // Format revenue data
    const formattedRevenue = [];
    const revenueMap = new Map();
    revenueData.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      revenueMap.set(key, { revenue: item.revenue, bookings: item.bookings });
    });

    const bookingMap = new Map();
    bookingData.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      bookingMap.set(key, item.count);
    });

    for (let i = 7; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      const data = revenueMap.get(key) || { revenue: 0, bookings: 0 };
      const bookingCount = bookingMap.get(key) || 0;
      formattedRevenue.push({
        name: monthNames[month - 1],
        revenue: data.revenue,
        bookings: bookingCount
      });
    }

    // Format category data
    const totalExpertsForPercentage = await Expert.countDocuments();
    const formattedCategories = categoryData.map((item, index) => {
      const colors = ['#004d4d', '#ffd700', '#ff6f61', '#00b3b3', '#10b981'];
      return {
        name: item._id || 'Other',
        value: totalExpertsForPercentage > 0 
          ? Math.round((item.count / totalExpertsForPercentage) * 100) 
          : 0,
        color: colors[index % colors.length]
      };
    });

    // Format recent bookings
    const formattedRecentBookings = recentBookings.map(booking => ({
      id: booking._id.toString().substring(0, 8).toUpperCase(),
      user: booking.user 
        ? `${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim() 
        : 'N/A',
      expert: booking.expert 
        ? `${booking.expert.firstName || ''} ${booking.expert.lastName || ''}`.trim() 
        : 'N/A',
      service: booking.expert?.specialization || 'N/A',
      date: booking.sessionDate ? new Date(booking.sessionDate).toISOString().split('T')[0] : 'N/A',
      time: booking.startTime || 'N/A',
      status: booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'Pending',
      amount: booking.price || 0
    }));

    // Calculate percentage changes (comparing last month to previous month)
    const currentMonth = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(currentMonth.getMonth() - 1);
    const previousMonth = new Date();
    previousMonth.setMonth(currentMonth.getMonth() - 2);

    // User growth percentage
    const currentMonthUsers = await User.countDocuments({
      userType: 'user',
      createdAt: {
        $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        $lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      }
    });
    const previousMonthUsers = await User.countDocuments({
      userType: 'user',
      createdAt: {
        $gte: new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1),
        $lt: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1)
      }
    });
    const userGrowthPercent = previousMonthUsers > 0 
      ? Math.round(((currentMonthUsers - previousMonthUsers) / previousMonthUsers) * 100) 
      : 0;

    // Expert growth percentage
    const currentMonthExperts = await Expert.countDocuments({
      createdAt: {
        $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        $lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      }
    });
    const previousMonthExperts = await Expert.countDocuments({
      createdAt: {
        $gte: new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1),
        $lt: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1)
      }
    });
    const expertGrowthPercent = previousMonthExperts > 0 
      ? Math.round(((currentMonthExperts - previousMonthExperts) / previousMonthExperts) * 100) 
      : 0;

    // Booking growth percentage
    const currentMonthBookings = await Appointment.countDocuments({
      createdAt: {
        $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        $lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      }
    });
    const previousMonthBookings = await Appointment.countDocuments({
      createdAt: {
        $gte: new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1),
        $lt: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1)
      }
    });
    const bookingGrowthPercent = previousMonthBookings > 0 
      ? Math.round(((currentMonthBookings - previousMonthBookings) / previousMonthBookings) * 100) 
      : 0;

    // Revenue growth percentage
    const currentMonthRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: {
            $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
            $lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const previousMonthRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: {
            $gte: new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1),
            $lt: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1)
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const currentRevenue = currentMonthRevenue[0]?.total || 0;
    const previousRevenue = previousMonthRevenue[0]?.total || 0;
    const revenueGrowthPercent = previousRevenue > 0 
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) 
      : 0;

    // Calculate conversion rate (completed bookings / total bookings)
    const totalBookings = await Appointment.countDocuments();
    const completedBookings = await Appointment.countDocuments({ status: 'completed' });
    const conversionRate = totalBookings > 0 
      ? ((completedBookings / totalBookings) * 100).toFixed(1) 
      : '0.0';

    // Calculate average session value
    const avgSessionValue = await Payment.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: null,
          avg: { $avg: '$amount' }
        }
      }
    ]);
    const avgValue = avgSessionValue[0]?.avg || 0;

    // Calculate customer satisfaction (average rating from appointments with feedback)
    const satisfactionData = await Appointment.aggregate([
      {
        $match: {
          feedbackRating: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$feedbackRating' },
          count: { $sum: 1 }
        }
      }
    ]);
    const avgRating = satisfactionData[0]?.avgRating || 0;
    const customerSatisfaction = avgRating > 0 ? (avgRating / 5).toFixed(1) : '0.0';

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalExperts,
          activeBookings,
          monthlyRevenue
        },
        growth: {
          users: userGrowthPercent,
          experts: expertGrowthPercent,
          bookings: bookingGrowthPercent,
          revenue: revenueGrowthPercent
        },
        revenueData: formattedRevenue,
        userGrowthData: formattedUserGrowth,
        categoryData: formattedCategories,
        recentBookings: formattedRecentBookings,
        topExperts: topExperts.map(expert => ({
          name: expert.name,
          sessions: expert.sessions,
          revenue: expert.revenue,
          rating: expert.rating || 0
        })),
        metrics: {
          conversionRate,
          avgSessionValue: Math.round(avgValue),
          customerSatisfaction: `${customerSatisfaction}/5`
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

